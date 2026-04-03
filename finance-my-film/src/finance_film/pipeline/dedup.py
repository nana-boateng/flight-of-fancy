"""Opportunity deduplication."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from finance_film.models import Opportunity

if TYPE_CHECKING:
    pass


def normalize_title(title: str) -> str:
    """Normalize title for comparison."""
    title = title.lower()
    title = re.sub(r"[^\w\s]", "", title)
    title = " ".join(title.split())
    return title


def title_similarity(title1: str, title2: str) -> float:
    """Calculate similarity between two titles (0-1)."""
    norm1 = normalize_title(title1)
    norm2 = normalize_title(title2)

    if norm1 == norm2:
        return 1.0

    if norm1 in norm2 or norm2 in norm1:
        len_diff = abs(len(norm1) - len(norm2))
        max_len = max(len(norm1), len(norm2))
        if max_len == 0:
            return 1.0
        return 1.0 - (len_diff / max_len)

    words1 = set(norm1.split())
    words2 = set(norm2.split())
    if not words1 or not words2:
        return 0.0

    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)


def deduplicate_opportunities(
    opportunities: list[Opportunity],
    existing_urls: set[str] | None = None,
    existing_titles: set[str] | None = None,
    similarity_threshold: float = 0.85,
) -> list[Opportunity]:
    """
    Deduplicate opportunities.

    Args:
        opportunities: List of opportunities to deduplicate
        existing_urls: Set of URLs already seen
        existing_titles: Set of normalized titles already seen
        similarity_threshold: Threshold for title similarity (0-1)

    Returns:
        List of unique opportunities
    """
    if existing_urls is None:
        existing_urls = set()
    if existing_titles is None:
        existing_titles = set()

    unique: list[Opportunity] = []

    for opp in opportunities:
        if opp.url and opp.url in existing_urls:
            continue

        norm_title = normalize_title(opp.title)

        is_duplicate = False
        for seen_title in existing_titles:
            if title_similarity(norm_title, seen_title) >= similarity_threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            unique.append(opp)
            existing_titles.add(norm_title)
            if opp.url:
                existing_urls.add(opp.url)

    return unique


def deduplicate_within_list(
    opportunities: list[Opportunity],
    similarity_threshold: float = 0.85,
) -> list[Opportunity]:
    """Deduplicate within a single list of opportunities."""
    seen_titles: set[str] = set()
    seen_urls: set[str] = set()
    return deduplicate_opportunities(
        opportunities,
        seen_urls,
        seen_titles,
        similarity_threshold,
    )
