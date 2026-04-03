"""AI provider source adapter (optional enrichment)."""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
from typing import TYPE_CHECKING, Literal

import structlog

from finance_film.config import AIProviderSettings
from finance_film.models import Opportunity, OpportunityCategory, Source, SourceType
from finance_film.sources.base import BaseSourceAdapter, SourceError, SourceTimeoutError

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()

RESEARCH_PROMPTS = {
    "grant": (
        "List 5 Canadian film grants for first-time filmmakers with their dollar amounts. "
        "Include: Telefilm Talent to Watch, Toronto Arts Council, Ontario Arts Council, "
        "Canada Council for the Arts, LIFT grants. "
        'Return JSON: [{"title": "name", "url": "link", "amount": "$X CAD", "deadline": "date or rolling"}]'
    ),
    "investor": (
        "List 3 Canadian film investors or funds that invest in short films under $50k. "
        "Include: The Talent Fund, private investors. "
        'Return JSON: [{"title": "name", "url": "link", "investment_range": "$X-$Y"}]'
    ),
    "competition": (
        "List 3 Canadian film festivals with cash prizes for short films in 2026. "
        "Include: TIFF, Hot Docs, local festivals. "
        'Return JSON: [{"title": "name", "url": "link", "cash_prize": "$X", "deadline": "date"}]'
    ),
}


class AIProviderAdapter(BaseSourceAdapter):
    """Adapter for AI-powered research (optional)."""

    def __init__(
        self,
        source: Source,
        settings: AIProviderSettings,
        prompts: dict[str, str] | None = None,
    ) -> None:
        super().__init__(source)
        self.settings = settings
        self.prompts = prompts or RESEARCH_PROMPTS

    async def fetch(self) -> list[Opportunity]:
        """Fetch opportunities using AI research."""
        if not self.settings.enabled:
            logger.info("ai_provider_disabled", source=self.source_name)
            return []

        all_opportunities: list[Opportunity] = []

        for category, prompt in self.prompts.items():
            try:
                opps = await self._run_research(category, prompt)
                all_opportunities.extend(opps)
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(
                    "ai_research_error",
                    source=self.source_name,
                    category=category,
                    error=str(e),
                )

        logger.info(
            "ai_fetch_complete",
            source=self.source_name,
            opportunities=len(all_opportunities),
        )
        return all_opportunities

    async def _run_research(self, category: str, prompt: str) -> list[Opportunity]:
        """Run AI research for a specific category."""
        try:
            result = await asyncio.wait_for(
                self._call_opencode(prompt),
                timeout=self.settings.timeout_seconds,
            )

            if result:
                return self._parse_result(result, category)
            return []

        except asyncio.TimeoutError as e:
            raise SourceTimeoutError(self.source_name, "AI request timed out", e)

    async def _call_opencode(self, prompt: str) -> str | None:
        """Call opencode CLI with a prompt."""
        cmd = ["opencode", "run", "--format", "json"]
        if self.settings.model:
            cmd.extend(["-m", self.settings.model])
        cmd.append(prompt)

        logger.debug("ai_call_start", prompt_preview=prompt[:100])

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()

            if proc.returncode == 0:
                return stdout.decode("utf-8")
            else:
                logger.error(
                    "ai_call_failed",
                    returncode=proc.returncode,
                    stderr=stderr.decode("utf-8")[:500],
                )
                return None

        except FileNotFoundError:
            logger.error("ai_call_not_found", error="opencode not found on PATH")
            return None

    def _parse_result(self, raw_output: str, category: str) -> list[Opportunity]:
        """Parse AI output into opportunities."""
        opportunities: list[Opportunity] = []

        ai_text_parts: list[str] = []
        tool_output_parts: list[str] = []

        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                if not isinstance(event, dict):
                    continue
                etype = event.get("type", "")
                part = event.get("part", {})

                if etype == "text":
                    txt = part.get("text", "")
                    if isinstance(txt, str) and txt.strip():
                        ai_text_parts.append(txt.strip())
                elif etype == "tool_use":
                    state = part.get("state", {})
                    output = state.get("output", "")
                    if isinstance(output, str) and output.strip():
                        tool_output_parts.append(output.strip())

            except json.JSONDecodeError:
                ai_text_parts.append(line)

        ai_text = "\n".join(ai_text_parts)
        parsed = self._try_parse_json_items(ai_text, category)
        if parsed:
            opportunities.extend(parsed)
        else:
            all_text = ai_text + "\n" + "\n".join(tool_output_parts)
            parsed = self._try_parse_json_items(all_text, category)
            if parsed:
                opportunities.extend(parsed)

        if not opportunities and len(ai_text.strip()) > 50:
            opportunities.append(
                Opportunity(
                    title=f"AI Research: {category.title()} leads - Toronto/Ontario",
                    source=f"AI Research ({category})",
                    source_type=SourceType.AI_RESEARCH,
                    url=None,
                    description=ai_text[:500],
                    category=self._map_category(category),
                    difficulty_score=5,
                )
            )

        return opportunities

    def _try_parse_json_items(self, text: str, category: str) -> list[Opportunity]:
        """Try to extract JSON array of opportunities from text."""
        results: list[Opportunity] = []

        matches = list(re.finditer(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL))
        if not matches:
            matches = list(re.finditer(r"(\[\s*\{.*?\}\s*\])", text, re.DOTALL))

        for match in reversed(matches):
            try:
                items = json.loads(match.group(1))
                if not isinstance(items, list) or not items:
                    continue

                for item in items:
                    if not isinstance(item, dict):
                        continue

                    title = item.get("title", "")
                    if not title or title == "Untitled":
                        continue

                    amount_src = str(
                        item.get("amount_range", item.get("amount", item.get("cash_prize", "")))
                    )
                    amount = self._extract_amount(amount_src)

                    desc_parts = [item.get("description", "")]
                    if item.get("eligibility"):
                        desc_parts.append(f"Eligibility: {item['eligibility']}")
                    if item.get("type"):
                        desc_parts.append(f"Type: {item['type']}")
                    description = " | ".join(p for p in desc_parts if p)[:500]

                    difficulty = item.get("difficulty")
                    if isinstance(difficulty, (int, float)):
                        difficulty = max(1, min(10, int(difficulty)))
                    else:
                        difficulty = 5

                    results.append(
                        Opportunity(
                            title=title,
                            source=f"AI Research ({category})",
                            source_type=SourceType.AI_RESEARCH,
                            url=item.get("url"),
                            amount_cad=amount,
                            description=description or None,
                            category=self._map_category(category),
                            difficulty_score=difficulty,
                        )
                    )

                if results:
                    return results

            except json.JSONDecodeError:
                continue

        return results

    def _extract_amount(self, text: str) -> float | None:
        """Extract monetary amount from text."""
        patterns = [
            r"\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(\d{1,3}(?:,\d{3})*)\s*CAD",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(",", "")
                try:
                    return float(amount_str)
                except ValueError:
                    continue
        return None

    def _map_category(self, category: str) -> OpportunityCategory:
        """Map category string to enum."""
        mapping: dict[str, OpportunityCategory] = {
            "fund": OpportunityCategory.FUND,
            "grant": OpportunityCategory.GRANT,
            "competition": OpportunityCategory.COMPETITION,
            "investor": OpportunityCategory.INVESTOR,
            "networking": OpportunityCategory.NETWORKING,
        }
        return mapping.get(category.lower(), OpportunityCategory.GRANT)


def get_ai_source(settings: AIProviderSettings) -> Source:
    """Get AI research source."""
    return Source(
        name="AI Research",
        url="opencode://research",
        source_type=SourceType.AI_RESEARCH,
        active=settings.enabled,
    )
