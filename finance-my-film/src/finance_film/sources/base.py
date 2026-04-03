"""Base protocol and utilities for source adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Protocol, runtime_checkable

from finance_film.models import Opportunity, Source

if TYPE_CHECKING:
    pass


@runtime_checkable
class SourceAdapter(Protocol):
    """Protocol for source adapters."""

    async def fetch(self) -> list[Opportunity]:
        """Fetch opportunities from this source."""
        ...

    @property
    def source_name(self) -> str:
        """Name of this source."""
        ...


class BaseSourceAdapter(ABC):
    """Base class for source adapters with common utilities."""

    def __init__(self, source: Source) -> None:
        self.source = source

    @property
    def source_name(self) -> str:
        return self.source.name

    @abstractmethod
    async def fetch(self) -> list[Opportunity]:
        """Fetch opportunities from this source."""
        ...


class SourceError(Exception):
    """Error from a source adapter."""

    def __init__(self, source_name: str, message: str, original: Exception | None = None) -> None:
        self.source_name = source_name
        self.message = message
        self.original = original
        super().__init__(f"[{source_name}] {message}")


class SourceTimeoutError(SourceError):
    """Timeout error from a source."""

    pass


class SourceRateLimitError(SourceError):
    """Rate limit error from a source."""

    def __init__(
        self,
        source_name: str,
        retry_after: float | None = None,
        original: Exception | None = None,
    ) -> None:
        self.retry_after = retry_after
        super().__init__(source_name, "Rate limited", original)
