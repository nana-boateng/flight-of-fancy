"""File log notification channel."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

import structlog

from finance_film.config import NotificationSettings
from finance_film.models import Digest
from finance_film.notifiers.base import BaseNotifier

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


class FileNotifier(BaseNotifier):
    """Notifier that writes to a log file."""

    def __init__(self, settings: NotificationSettings) -> None:
        self.file_path = settings.file_log_path
        self.separator = "=" * 50

    @property
    def channel_name(self) -> str:
        return "file"

    async def send(self, digest: Digest) -> bool:
        """Write digest to log file."""
        try:
            content = self._format_content(digest)
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.file_path, "a", encoding="utf-8") as f:
                f.write(content)
            logger.info("file_log_written", path=str(self.file_path), count=digest.new_count)
            return True
        except Exception as e:
            logger.error("file_log_error", error=str(e))
            return False

    def _format_content(self, digest: Digest) -> str:
        """Format digest as file content."""
        lines = [
            "",
            self.separator,
            datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            f"Film Funding Opportunities ({digest.new_count} new)",
            self.separator,
            "",
        ]

        for i, opp in enumerate(digest.opportunities, 1):
            lines.append(f"{i}. {opp.title}")
            lines.append(f"   Source: {opp.source}")
            lines.append(f"   Type: {opp.category.value}")
            if opp.amount_cad:
                lines.append(f"   Amount: ${opp.amount_cad:,.0f} CAD")
            if opp.fit_score:
                lines.append(
                    f"   Fit Score: {opp.fit_score}/10 (personalized for Toronto emerging filmmaker)"
                )
            else:
                lines.append(f"   Difficulty: {opp.difficulty_score}/10")
            labels = [
                "starter-friendly" if opp.starter_friendly else "not-starter",
                "requires-company" if opp.requires_company else "individual-ok",
                "direct-cash" if opp.direct_cash else "non-cash",
            ]
            lines.append(f"   Labels: {', '.join(labels)}")
            if opp.url:
                lines.append(f"   URL: {opp.url}")
            if opp.description:
                lines.append(f"   Description: {opp.description[:200]}...")
            lines.append("")

        lines.extend(["", self.separator, ""])
        return "\n".join(lines)
