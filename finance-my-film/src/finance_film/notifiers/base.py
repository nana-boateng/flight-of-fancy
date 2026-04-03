"""Notifier protocol and base classes."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from finance_film.models import Digest

if TYPE_CHECKING:
    pass


@runtime_checkable
class Notifier(Protocol):
    """Protocol for notification channels."""

    async def send(self, digest: Digest) -> bool:
        """Send a digest notification. Returns True if successful."""
        ...

    @property
    def channel_name(self) -> str:
        """Name of this notification channel."""
        ...


class BaseNotifier(ABC):
    """Base class for notifiers."""

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Name of this notification channel."""
        ...

    @abstractmethod
    async def send(self, digest: Digest) -> bool:
        """Send a digest notification."""
        ...


class NotificationError(Exception):
    """Error from a notifier."""

    def __init__(self, channel: str, message: str, original: Exception | None = None) -> None:
        self.channel = channel
        self.message = message
        self.original = original
        super().__init__(f"[{channel}] {message}")
