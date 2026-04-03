"""ntfy.sh notification channel."""

from __future__ import annotations

from typing import TYPE_CHECKING

import aiohttp
import structlog

from finance_film.config import NotificationSettings
from finance_film.models import Digest
from finance_film.notifiers.base import BaseNotifier, NotificationError

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


class NtfyNotifier(BaseNotifier):
    """Notifier for ntfy.sh push notifications."""

    def __init__(self, settings: NotificationSettings) -> None:
        if not settings.ntfy_url or not settings.ntfy_topic:
            msg = "ntfy_url and ntfy_topic must be configured"
            raise ValueError(msg)
        self.url = settings.ntfy_url.rstrip("/")
        self.topic = settings.ntfy_topic
        self._session: aiohttp.ClientSession | None = None

    @property
    def channel_name(self) -> str:
        return "ntfy"

    async def send(self, digest: Digest) -> bool:
        """Send digest via ntfy."""
        message = self._format_message(digest)

        try:
            if self._session is None:
                self._session = aiohttp.ClientSession()

            url = f"{self.url}/{self.topic}"
            async with self._session.post(
                url,
                data=message.encode("utf-8"),
                headers={
                    "Title": f"Film Funding Opportunities ({digest.new_count} new)",
                    "Priority": "default",
                    "Tags": "movie_camera",
                },
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                if response.status == 200:
                    logger.info("ntfy_sent", count=digest.new_count)
                    return True
                else:
                    text = await response.text()
                    logger.error("ntfy_failed", status=response.status, error=text)
                    return False

        except Exception as e:
            raise NotificationError(self.channel_name, str(e), e)

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session:
            await self._session.close()
            self._session = None

    def _format_message(self, digest: Digest) -> str:
        """Format digest as message text."""
        lines = [f"Daily Film Funding Digest - {digest.new_count} new opportunities", ""]

        for i, opp in enumerate(digest.opportunities, 1):
            lines.append(f"{i}. {opp.title}")
            lines.append(f"   Source: {opp.source}")
            lines.append(f"   Type: {opp.category.value}")
            if opp.amount_cad:
                lines.append(f"   Amount: ${opp.amount_cad:,.0f}")
            if opp.fit_score:
                lines.append(f"   Fit Score: {opp.fit_score}/10")
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
            lines.append("")

        return "\n".join(lines)
