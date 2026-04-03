"""Opportunity scoring engine."""

from __future__ import annotations

import re
from datetime import date
from typing import TYPE_CHECKING

from finance_film.config import FilmmakerProfile, ScoringWeights
from finance_film.models import Opportunity, OpportunityCategory

if TYPE_CHECKING:
    pass

EMERGING_KEYWORDS = [
    "emerging",
    "new filmmaker",
    "first-time",
    "first time",
    "debut",
    "student",
    "early career",
    "open call",
    "no experience required",
    "beginner",
]

SHORT_FILM_KEYWORDS = [
    "short film",
    "short-form",
    "short form",
    "micro-budget",
    "micro budget",
    "debut",
    "first project",
]

LOCATION_KEYWORDS = [
    "toronto",
    "ontario",
    "gta",
    "canada",
    "canadian",
]

CANADA_SOURCE_KEYWORDS = [
    "canada",
    "canadian",
    "ontario",
    "toronto",
    "telefilm",
    "nfb",
    "rogers",
    "bell",
    "tac",
    "oac",
]

TRUSTED_BEGINNER_SOURCE_HINTS = [
    "telefilm",
    "toronto arts council",
    "ontario arts council",
    "lift",
    "nfb",
    "rogers documentary",
    "talent fund",
    "dgc",
]

BLOCKER_KEYWORDS = [
    "minimum 5 years",
    "minimum 3 years",
    "established filmmaker",
    "feature film experience",
    "previous funding required",
    "professional track record",
    "must have produced",
    "demonstrated track record",
    "previous credits required",
    "experienced only",
    "established only",
]

TAX_CREDIT_KEYWORDS = [
    "tax credit",
    "tax incentive",
    "tax rebate",
    "production services tax credit",
    "film and television tax credit",
    "computer animation tax credit",
    "digital media tax credit",
    "oidmtc",
    "oftc",
    "opstc",
    "cavco",
    "crtc",
    "certified production",
]

GRANT_KEYWORDS = [
    "grant",
    "funding program",
    "production fund",
    "development fund",
    "short film fund",
    "emerging filmmaker",
    "first-time filmmaker",
    "debut feature",
    "micro-budget",
    "low-budget film",
    "indie film funding",
    "film completion fund",
    "post-production fund",
    "screenwriting grant",
    "development grant",
    "travel grant",
    "festival submission",
    "pitch competition",
    "cash prize",
    "award program",
]

GENERIC_PAGE_KEYWORDS = [
    "guide to",
    "granting information",
    "general granting",
    "apply for a grant",
    "grants online",
    "funding opportunities",
    "funding decisions",
    "strategic funds",
    "explore funding",
    "program overview",
]

SPECIFICITY_KEYWORDS = [
    "short film",
    "short-film",
    "emerging",
    "first-time",
    "debut",
    "talent to watch",
    "media artists",
    "filmmaker assistance",
    "documentary fund",
    "pitch",
    "cash prize",
    "open call",
    "submission",
    "deadline",
    "investor",
    "angel",
]

COMPETITIVE_KEYWORDS = [
    "competitive",
    "limited spots",
    "prestigious",
    "juried",
    "highly selective",
]

COMPANY_REQUIRED_KEYWORDS = [
    "must be incorporated",
    "incorporated production company",
    "eligible company",
    "company must",
    "corporation",
    "corporate applicant",
]


class ScoringEngine:
    """Engine for scoring opportunities based on filmmaker profile."""

    def __init__(
        self,
        profile: FilmmakerProfile,
        weights: ScoringWeights,
    ) -> None:
        self.profile = profile
        self.weights = weights

    def score(self, opp: Opportunity) -> tuple[int, float, str | None]:
        """
        Score an opportunity.

        Returns:
            Tuple of (difficulty_score, confidence_score, rejection_reason)
        """
        text = f"{opp.title} {opp.description or ''}".lower()

        labels = self._derive_relevance_labels(text)
        opp.starter_friendly = labels["starter_friendly"]
        opp.requires_company = labels["requires_company"]
        opp.direct_cash = labels["direct_cash"]

        if not self._passes_hard_eligibility(text, opp.source):
            return 10, 0.9, "Fails hard gate: must match short-film + emerging + Canada"

        evidence_score = self._evidence_score(opp, text)
        if evidence_score < 2:
            return 8, 0.75, "Insufficient evidence (need amount/deadline/contact/eligibility)"

        if opp.category == OpportunityCategory.NEWS:
            return 10, 0.9, "News article - not a direct funding opportunity"

        if self._is_generic_page(text):
            return 9, 0.8, "Generic information/navigation page"

        if not self._is_specific_enough(text):
            return 8, 0.7, "Not specific to short-film/beginner funding"

        if self._is_tax_credit(text):
            return 10, 1.0, "Tax credit/incentive - not direct funding"

        if self._has_blockers(text):
            return 10, 0.9, "Requires established track record"

        difficulty = 5
        confidence = 0.5

        for kw in EMERGING_KEYWORDS:
            if kw in text:
                difficulty -= 1
                confidence += 0.1

        for kw in LOCATION_KEYWORDS:
            if kw in text:
                difficulty -= 1
                confidence += 0.05

        for kw in COMPETITIVE_KEYWORDS:
            if kw in text:
                difficulty += 2
                confidence += 0.1

        for kw in GRANT_KEYWORDS:
            if kw in text:
                difficulty -= 1
                confidence += 0.1
                break

        if opp.amount_cad:
            if opp.amount_cad > 100_000:
                difficulty += 2
            elif opp.amount_cad > 50_000:
                difficulty += 1
            elif opp.amount_cad < 5_000:
                difficulty -= 1
                confidence += 0.1

            if opp.amount_cad <= self.profile.max_budget_cad:
                confidence += 0.1
            else:
                difficulty += 1

        if opp.deadline:
            days_until = (opp.deadline - date.today()).days
            if days_until < 0:
                return 10, 1.0, "Deadline has passed"
            if days_until < 7:
                difficulty += 1
            elif days_until < 30:
                pass
            else:
                confidence += 0.05

        if opp.url:
            confidence += 0.1
        if opp.description:
            confidence += 0.05
        if opp.eligibility:
            confidence += 0.1

        difficulty = max(1, min(10, difficulty))
        confidence = max(0.0, min(1.0, confidence))

        return difficulty, confidence, None

    def _is_tax_credit(self, text: str) -> bool:
        """Check if this is a tax credit rather than direct funding."""
        for kw in TAX_CREDIT_KEYWORDS:
            if kw in text:
                return True
        return False

    def _has_blockers(self, text: str) -> bool:
        """Check if text contains blocker keywords."""
        for blocker in BLOCKER_KEYWORDS:
            if blocker in text:
                return True
        return False

    def _is_generic_page(self, text: str) -> bool:
        """Check if text appears to be a generic listing or navigation page."""
        for keyword in GENERIC_PAGE_KEYWORDS:
            if keyword in text:
                return True
        return False

    def _is_specific_enough(self, text: str) -> bool:
        """Require short-film / emerging-filmmaker specific signals."""
        for keyword in SPECIFICITY_KEYWORDS:
            if keyword in text:
                return True
        return False

    def _passes_hard_eligibility(self, text: str, source: str) -> bool:
        """Hard gate: only keep short-film, beginner-friendly, Canada-relevant leads."""
        source_lower = source.lower()

        canada_match = (
            any(keyword in text for keyword in LOCATION_KEYWORDS)
            or any(keyword in source_lower for keyword in CANADA_SOURCE_KEYWORDS)
            or any(keyword in source_lower for keyword in TRUSTED_BEGINNER_SOURCE_HINTS)
        )

        short_match = any(keyword in text for keyword in SHORT_FILM_KEYWORDS) or any(
            keyword in source_lower
            for keyword in ["short", "documentary", "talent", "filmmaker", "media artists"]
        )

        emerging_match = any(keyword in text for keyword in EMERGING_KEYWORDS) or any(
            keyword in source_lower
            for keyword in [
                "talent to watch",
                "media artists",
                "filmmaker assistance",
                "production grants",
                "talent fund",
            ]
        )

        return short_match and emerging_match and canada_match

    def _derive_relevance_labels(self, text: str) -> dict[str, bool]:
        """Derive relevance labels to persist in DB and show in digest."""
        requires_company = any(keyword in text for keyword in COMPANY_REQUIRED_KEYWORDS)
        starter_friendly = (
            any(keyword in text for keyword in EMERGING_KEYWORDS) and not requires_company
        )
        direct_cash = not self._is_tax_credit(text)
        return {
            "starter_friendly": starter_friendly,
            "requires_company": requires_company,
            "direct_cash": direct_cash,
        }

    def _evidence_score(self, opp: Opportunity, text: str) -> int:
        """Minimum evidence score for actionable opportunities."""
        score = 0

        if opp.amount_cad is not None or re.search(r"\$\s?\d", text):
            score += 1

        if opp.deadline is not None or re.search(
            r"\b(20\d{2}-\d{2}-\d{2}|deadline|rolling)\b", text
        ):
            score += 1

        has_contact_signal = bool(
            opp.url
            or re.search(r"[\w.-]+@[\w.-]+\.[A-Za-z]{2,}", text)
            or "apply" in text
            or "submission" in text
        )
        if has_contact_signal:
            score += 1

        if any(k in text for k in ["eligible", "eligibility", "applicant", "who can apply"]):
            score += 1

        return score

    def calculate_fit_score(self, opp: Opportunity) -> int:
        """Calculate fit score (1-10, higher is better fit)."""
        text = f"{opp.title} {opp.description or ''}".lower()

        score = 5

        for kw in EMERGING_KEYWORDS:
            if kw in text:
                score += 1

        for kw in LOCATION_KEYWORDS:
            if kw in text:
                score += 1

        if opp.amount_cad:
            if opp.amount_cad <= self.profile.target_amount_cad:
                score += 1
            if opp.amount_cad <= self.profile.max_budget_cad:
                score += 1

        if opp.category.value in ("grant", "fund"):
            score += 1
        elif opp.category.value == "competition":
            score += 0.5

        return max(1, min(10, int(score)))
