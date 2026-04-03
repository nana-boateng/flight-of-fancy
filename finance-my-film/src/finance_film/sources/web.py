"""Web scraping source adapter."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

import bs4
import structlog

from finance_film.models import Opportunity, OpportunityCategory, Source, SourceType
from finance_film.sources.base import BaseSourceAdapter, SourceError
from finance_film.sources.http_client import HTTPClient

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()

FUNDING_KEYWORDS = ["grant", "fund", "financ", "program", "support", "credit"]

JUNK_PATTERNS = [
    "faq",
    "glossary",
    "about",
    "contact",
    "login",
    "sign up",
    "search",
    "calendar",
    "recipients",
    "eligibility",
    "how to apply",
    "learn more",
    "find out more",
    "get more information",
    "grant category",
    "funding type",
    "recipient list",
    "acknowledging",
    "unsuccessful",
    "glossary",
    "our programs",
    "we finance",
    "we partner",
    "program overview",
    "apply for funding",
    "financing plan",
    "accounting",
    "reporting requirements",
    "logos",
    "brand guidelines",
    "template",
    ".pdf",
    "#program",
    "#apply",
    "framework",
    "back to",
    "grant online",
    "deadlines",
    "important dates",
    "magazine fund",
    "enterprise fund",
    "publishing",
    "business intelligence",
    "industry development",
    "grant results",
    "statistics",
    "evaluation",
    "terms and conditions",
    "accessibility fund",
    "support material",
    "application support",
    "guide to",
    "general granting information",
    "apply for a grant",
    "grants online",
    "funding decisions",
    "strategic funds",
    "funding opportunities",
    "explore funding",
]

WRONG_SECTOR_PATTERNS = [
    "book fund",
    "magazine",
    "literary",
    "publishing",
    "podcast",
    "gaming",
    "video game",
]


class WebSourceAdapter(BaseSourceAdapter):
    """Adapter for web scraping sources."""

    def __init__(
        self,
        source: Source,
        http_client: HTTPClient,
        funding_keywords: list[str] | None = None,
        junk_patterns: list[str] | None = None,
    ) -> None:
        super().__init__(source)
        self.http_client = http_client
        self.funding_keywords = funding_keywords or FUNDING_KEYWORDS
        self.junk_patterns = junk_patterns or JUNK_PATTERNS

    async def fetch(self) -> list[Opportunity]:
        """Fetch opportunities by scraping web page."""
        try:
            content = await self.http_client.get(self.source.url)
            soup = bs4.BeautifulSoup(content, "lxml")

            specialized = self._extract_source_specific(soup)
            if specialized:
                logger.info(
                    "web_fetch_complete",
                    source=self.source_name,
                    opportunities=len(specialized),
                    mode="source_specific",
                )
                return specialized

            opportunities = []
            seen_urls: set[str] = set()

            for element in soup.find_all(["a", "h2", "h3", "h4"]):
                opp = self._parse_element(element, seen_urls)
                if opp:
                    opportunities.append(opp)

            logger.info(
                "web_fetch_complete",
                source=self.source_name,
                opportunities=len(opportunities),
                mode="generic",
            )
            return opportunities

        except Exception as e:
            raise SourceError(self.source_name, str(e), e) from e

    def _extract_source_specific(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        source = self.source_name.lower()
        if "telefilm" in source:
            return self._extract_telefilm(soup)
        if "toronto arts council" in source:
            return self._extract_tac(soup)
        if "ontario arts council" in source:
            return self._extract_oac(soup)
        if "nfb" in source or "filmmaker assistance" in source:
            return self._extract_nfb(soup)
        if "rogers documentary" in source:
            return self._extract_rogers(soup)
        return []

    def _build_specific_opp(
        self,
        title: str,
        url: str | None,
        description: str,
        category: OpportunityCategory,
        amount: float | None = None,
    ) -> Opportunity:
        return Opportunity(
            title=title,
            source=self.source_name,
            source_type=self.source.source_type,
            url=url,
            amount_cad=amount,
            description=description[:500] if description else None,
            category=category,
            difficulty_score=4,
        )

    def _extract_telefilm(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        text = soup.get_text(" ", strip=True)
        amount = self._extract_amount(text)
        return [
            self._build_specific_opp(
                "Telefilm Talent to Watch Program",
                self.source.url,
                "Direct support for emerging filmmakers and first features/short-form pathways in Canada.",
                OpportunityCategory.GRANT,
                amount,
            )
        ]

    def _extract_tac(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        text = soup.get_text(" ", strip=True)
        amount = self._extract_amount(text)
        return [
            self._build_specific_opp(
                "Toronto Arts Council Media Artists Grant",
                self.source.url,
                "Toronto-based grant stream for media artists and emerging filmmakers.",
                OpportunityCategory.GRANT,
                amount,
            )
        ]

    def _extract_oac(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        text = soup.get_text(" ", strip=True)
        amount = self._extract_amount(text)
        return [
            self._build_specific_opp(
                "Ontario Arts Council Media Artists Creation Projects",
                self.source.url,
                "Ontario grant program supporting media artists and independent creators.",
                OpportunityCategory.GRANT,
                amount,
            )
        ]

    def _extract_nfb(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        return [
            self._build_specific_opp(
                "NFB Filmmaker Assistance Program (FAP)",
                self.source.url,
                "Support for independent filmmakers through technical and production assistance.",
                OpportunityCategory.GRANT,
            )
        ]

    def _extract_rogers(self, soup: bs4.BeautifulSoup) -> list[Opportunity]:
        text = soup.get_text(" ", strip=True)
        amount = self._extract_amount(text)
        return [
            self._build_specific_opp(
                "Rogers Documentary Fund",
                self.source.url,
                "Private Canadian fund supporting documentary projects including emerging creators.",
                OpportunityCategory.FUND,
                amount,
            )
        ]

    def _parse_element(self, element: bs4.element.Tag, seen_urls: set[str]) -> Opportunity | None:
        """Parse an HTML element into an opportunity."""
        title = element.get_text(strip=True)
        if not title or len(title) < 5 or len(title) > 150:
            return None

        title_lower = title.lower()

        for pattern in self.junk_patterns:
            if pattern in title_lower:
                return None

        if title_lower in (
            "grants",
            "funding",
            "programs",
            "support",
            "financing",
            "apply",
            "resources",
        ):
            return None

        if not any(kw in title_lower for kw in self.funding_keywords):
            return None

        for pattern in WRONG_SECTOR_PATTERNS:
            if pattern in title_lower:
                return None

        url = element.get("href") if element.name == "a" else self.source.url
        if url:
            if url.startswith(("mailto:", "tel:", "javascript:", "#")):
                url = None
            elif not url.startswith("http"):
                from urllib.parse import urljoin

                url = urljoin(self.source.url, url)

        if url and url in seen_urls:
            return None
        if url:
            seen_urls.add(url)

        description = self._get_context_text(element)
        amount = self._extract_amount(title + " " + description)

        category = self._determine_category(title, description)

        return Opportunity(
            title=title,
            source=self.source_name,
            source_type=self.source.source_type,
            url=url,
            amount_cad=amount,
            description=description[:500] if description else None,
            category=category,
            difficulty_score=5,
        )

    def _get_context_text(self, element: bs4.element.Tag) -> str:
        """Get surrounding text context from an HTML element."""
        try:
            parent = element.parent
            if parent:
                text = parent.get_text(strip=True)
                next_sib = parent.next_sibling
                if next_sib and isinstance(next_sib, bs4.element.NavigableString):
                    text += " " + next_sib.strip()
                return text[:500]
        except Exception:
            pass
        return ""

    def _extract_amount(self, text: str) -> float | None:
        """Extract monetary amounts from text."""
        patterns = [
            r"\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"(\d{1,3}(?:,\d{3})*)\s*CAD",
            r"(\d{1,3}(?:,\d{3})*)\s*dollars?",
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

    def _determine_category(self, title: str, description: str) -> OpportunityCategory:
        """Determine opportunity category from title and description."""
        text = f"{title} {description}".lower()

        if "competition" in text or "pitch" in text:
            return OpportunityCategory.COMPETITION
        if "investor" in text or "angel" in text or "patron" in text:
            return OpportunityCategory.INVESTOR
        if "fund" in text and "grant" not in text:
            return OpportunityCategory.FUND
        return OpportunityCategory.GRANT


def get_default_web_sources() -> list[Source]:
    """Get default web scraping sources - focused on grants for emerging filmmakers."""
    return [
        Source(
            name="Telefilm Talent to Watch",
            url="https://www.telefilm.ca/en/programmes/talent-to-watch-program",
            source_type=SourceType.GOVERNMENT,
        ),
        Source(
            name="Toronto Arts Council Media Artists",
            url="https://www.torontoartscouncil.org/grants/media-artists-program-creation/",
            source_type=SourceType.MUNICIPAL,
        ),
        Source(
            name="Ontario Arts Council Media Artists",
            url="https://www.arts.on.ca/grants/media-artists-creation-projects",
            source_type=SourceType.PROVINCIAL,
        ),
        Source(
            name="LIFT Production Grants",
            url="https://lift.ca/support-grants/",
            source_type=SourceType.ORGANIZATION,
        ),
        Source(
            name="DGC Ontario Short Film Fund",
            url="https://www.dgc.ca/en/ontario/short-film-fund",
            source_type=SourceType.GUILD,
        ),
        Source(
            name="The Talent Fund",
            url="https://thetalentfund.ca/",
            source_type=SourceType.PRIVATE,
        ),
        Source(
            name="NFB Filmmaker Assistance Program",
            url="https://production.nfbonf.ca/en/filmmaker-assistance-program-fap/",
            source_type=SourceType.GOVERNMENT,
        ),
        Source(
            name="Rogers Documentary Fund",
            url="https://www.rogersgroupoffunds.com/tell-me-more/funds/documentary-fund/",
            source_type=SourceType.PRIVATE,
        ),
    ]
