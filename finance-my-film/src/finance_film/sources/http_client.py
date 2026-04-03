"""HTTP client with retry, timeout, and rate limiting."""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

import aiohttp
import structlog

from finance_film.config import HTTPSettings

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


class HTTPClient:
    """Async HTTP client with retry, timeout, and rate limiting."""

    def __init__(self, settings: HTTPSettings) -> None:
        self.settings = settings
        self._session: aiohttp.ClientSession | None = None
        self._host_last_request: dict[str, float] = {}
        self._host_locks: dict[str, asyncio.Lock] = {}

    async def __aenter__(self) -> HTTPClient:
        await self.start()
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    async def start(self) -> None:
        """Start the HTTP client session."""
        if self._session is None:
            timeout = aiohttp.ClientTimeout(total=self.settings.timeout_seconds)
            connector = aiohttp.TCPConnector(limit=self.settings.max_concurrent)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                connector=connector,
                headers={"User-Agent": self.settings.user_agent},
            )

    async def close(self) -> None:
        """Close the HTTP client session."""
        if self._session:
            await self._session.close()
            self._session = None

    async def get(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        raise_for_status: bool = True,
    ) -> str:
        """Fetch URL content with retry and rate limiting."""
        await self.start()

        host = self._extract_host(url)
        await self._rate_limit(host)

        last_error: Exception | None = None
        for attempt in range(self.settings.max_retries + 1):
            try:
                assert self._session is not None
                async with self._session.get(url, headers=headers) as response:
                    if raise_for_status:
                        response.raise_for_status()
                    return await response.text()
            except aiohttp.ClientError as e:
                last_error = e
                if attempt < self.settings.max_retries:
                    backoff = self.settings.retry_backoff_factor**attempt
                    logger.debug(
                        "http_retry",
                        url=url,
                        attempt=attempt + 1,
                        backoff=backoff,
                        error=str(e),
                    )
                    await asyncio.sleep(backoff)
                else:
                    raise

        raise last_error or RuntimeError("Unexpected error in HTTP client")

    async def post(
        self,
        url: str,
        *,
        data: bytes | str | None = None,
        headers: dict[str, str] | None = None,
        raise_for_status: bool = True,
    ) -> tuple[int, str]:
        """POST to URL and return status code and response text."""
        await self.start()

        host = self._extract_host(url)
        await self._rate_limit(host)

        assert self._session is not None
        async with self._session.post(url, data=data, headers=headers) as response:
            text = await response.text()
            if raise_for_status and response.status >= 400:
                raise aiohttp.ClientResponseError(
                    request_info=None,
                    history=(),
                    status=response.status,
                    message=text,
                )
            return response.status, text

    async def _rate_limit(self, host: str) -> None:
        """Apply rate limiting for a host."""
        if host not in self._host_locks:
            self._host_locks[host] = asyncio.Lock()

        async with self._host_locks[host]:
            last_request = self._host_last_request.get(host, 0)
            now = time.monotonic()
            elapsed = now - last_request
            if elapsed < self.settings.rate_limit_delay:
                await asyncio.sleep(self.settings.rate_limit_delay - elapsed)
            self._host_last_request[host] = time.monotonic()

    def _extract_host(self, url: str) -> str:
        """Extract host from URL for rate limiting."""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.netloc or url
