"""RSS/Atom feed source adapter."""

from __future__ import annotations

import re
from datetime import datetime
from typing import TYPE_CHECKING

import feedparser
import structlog

from finance_film.models import Opportunity, OpportunityCategory, Source, SourceType
from finance_film.sources.base import BaseSourceAdapter, SourceError
from finance_film.sources.http_client import HTTPClient

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()

FUNDING_KEYWORDS = [
    "funding",
    "grant",
    "investment",
    "financing",
    "call for entries",
    "pitch competition",
    "film fund",
    "angel investor",
    "private equity",
    "arts patron",
    "toronto",
    "ontario",
    "canadian film",
    "emerging",
    "first-time",
    "debut",
]

IRRELEVANT_PATTERNS = [
    "review",
    "interview",
    "opinion",
    "trailer",
    "cast",
    "celebrity",
    "oscars",
    "premiere",
    "box office",
    "streaming",
    "netflix",
    "hbo",
    "disney",
]


class RSSSourceAdapter(BaseSourceAdapter):
    """Adapter for RSS/Atom feed sources."""

    def __init__(
        self,
        source: Source,
        http_client: HTTPClient,
        keywords: list[str] | None = None,
    ) -> None:
        super().__init__(source)
        self.http_client = http_client
        self.keywords = keywords or FUNDING_KEYWORDS

    async def fetch(self) -> list[Opportunity]:
        """Fetch opportunities from RSS feed."""
        try:
            content = await self.http_client.get(self.source.url)
            feed = feedparser.parse(content)

            if feed.bozo and feed.bozo_exception:
                logger.warning(
                    "rss_parse_warning",
                    source=self.source_name,
                    error=str(feed.bozo_exception),
                )

            opportunities = []
            for entry in feed.entries:
                opp = self._parse_entry(entry)
                if opp and self._is_relevant(opp):
                    opportunities.append(opp)

            logger.info(
                "rss_fetch_complete",
                source=self.source_name,
                entries=len(feed.entries),
                opportunities=len(opportunities),
            )
            return opportunities

        except Exception as e:
            raise SourceError(self.source_name, str(e), e) from e

    def _parse_entry(self, entry: feedparser.FeedParserDict) -> Opportunity | None:
        """Parse an RSS entry into an opportunity."""
        title = getattr(entry, "title", None)
        if not title:
            return None

        title = " ".join(title.split())
        if len(title) < 5:
            return None

        link = getattr(entry, "link", None)
        summary = getattr(entry, "summary", getattr(entry, "description", ""))
        if summary:
            summary = " ".join(summary.split())[:500]

        published = getattr(entry, "published_parsed", None) or getattr(
            entry, "updated_parsed", None
        )
        deadline = None
        if published:
            try:
                deadline = datetime(*published[:6]).date()
            except (ValueError, TypeError):
                pass

        return Opportunity(
            title=title,
            source=self.source_name,
            source_type=SourceType.NEWS_FEED,
            url=link,
            description=summary,
            deadline=deadline,
            category=OpportunityCategory.NEWS,
            difficulty_score=5,
        )

    def _is_relevant(self, opp: Opportunity) -> bool:
        """Check if opportunity is relevant to film funding."""
        text = f"{opp.title} {opp.description or ''}".lower()

        for pattern in IRRELEVANT_PATTERNS:
            if pattern in text:
                return False

        for keyword in self.keywords:
            if keyword in text:
                return True

        return False


def get_default_rss_sources() -> list[Source]:
    """Get default RSS feed sources.

    Disabled by default because broad industry feeds add noisy, non-actionable results.
    """
    return []
