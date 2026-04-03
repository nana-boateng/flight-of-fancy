"""Notification manager for coordinating multiple channels."""

from __future__ import annotations

from typing import TYPE_CHECKING

import structlog

from finance_film.config import NotificationSettings, get_settings
from finance_film.db.repository import Database
from finance_film.models import Digest, OpportunityInDB
from finance_film.notifiers.base import Notifier
from finance_film.notifiers.file import FileNotifier
from finance_film.notifiers.ntfy import NtfyNotifier

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


class NotificationManager:
    """Manager for sending notifications via multiple channels."""

    def __init__(
        self,
        settings: NotificationSettings | None = None,
        db: Database | None = None,
    ) -> None:
        self.settings = settings or get_settings().notifications
        self.db = db
        self._notifiers: list[Notifier] = []
        self._setup_notifiers()

    def _setup_notifiers(self) -> None:
        """Set up configured notifiers."""
        self._notifiers.append(FileNotifier(self.settings))

        if self.settings.ntfy_url and self.settings.ntfy_topic:
            try:
                self._notifiers.append(NtfyNotifier(self.settings))
            except ValueError:
                logger.warning("ntfy_not_configured")

    async def send_digest(
        self,
        opportunities: list[OpportunityInDB],
        run_id: str | None = None,
    ) -> dict[str, bool]:
        """
        Send digest via all configured channels.

        Returns:
            Dict mapping channel name to success status.
        """
        if not opportunities:
            logger.info("no_opportunities_to_notify")
            return {}

        digest = Digest(
            generated_at=__import__("datetime").datetime.utcnow(),
            opportunities=opportunities,
            total_count=len(opportunities),
            new_count=sum(1 for o in opportunities if o.status.value == "new"),
        )

        results: dict[str, bool] = {}

        for notifier in self._notifiers:
            try:
                success = await notifier.send(digest)
                results[notifier.channel_name] = success

                if self.db and run_id:
                    with self.db.get_session() as session:
                        self.db.record_notification(
                            session,
                            run_id=run_id,
                            channel=notifier.channel_name,
                            success=success,
                            opportunity_count=len(opportunities),
                        )
                        session.commit()

                logger.info(
                    "notification_sent",
                    channel=notifier.channel_name,
                    success=success,
                )

            except Exception as e:
                logger.error(
                    "notification_error",
                    channel=notifier.channel_name,
                    error=str(e),
                )
                results[notifier.channel_name] = False

        return results

    async def close(self) -> None:
        """Close all notifiers."""
        for notifier in self._notifiers:
            if hasattr(notifier, "close"):
                await notifier.close()
