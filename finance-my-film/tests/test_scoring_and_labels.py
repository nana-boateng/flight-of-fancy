"""Golden tests for hard gate and relevance labels."""

from __future__ import annotations

import json
from pathlib import Path

from finance_film.config import FilmmakerProfile, ScoringWeights
from finance_film.models import Opportunity, OpportunityCategory, SourceType
from finance_film.pipeline.scoring import ScoringEngine


def _load_golden() -> list[dict]:
    fixture_path = Path(__file__).parent / "fixtures" / "scoring_golden.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


def _to_source_type(value: str) -> SourceType:
    return SourceType(value)


def _to_category(value: str) -> OpportunityCategory:
    return OpportunityCategory(value)


def test_scoring_golden_cases() -> None:
    engine = ScoringEngine(FilmmakerProfile(), ScoringWeights())

    for case in _load_golden():
        opp_data = case["opportunity"]
        expected = case["expected"]

        opp = Opportunity(
            title=opp_data["title"],
            source=opp_data["source"],
            source_type=_to_source_type(opp_data["source_type"]),
            category=_to_category(opp_data["category"]),
            url=opp_data.get("url"),
            description=opp_data.get("description"),
            amount_cad=opp_data.get("amount_cad"),
        )

        difficulty, _confidence, reason = engine.score(opp)
        rejected = reason is not None or difficulty > 7

        assert rejected == expected["rejected"], case["name"]

        if "reason_contains" in expected:
            assert reason is not None
            assert expected["reason_contains"] in reason

        if "starter_friendly" in expected:
            assert opp.starter_friendly == expected["starter_friendly"]

        if "direct_cash" in expected:
            assert opp.direct_cash == expected["direct_cash"]


def test_hard_gate_rejects_non_canadian_or_non_short_film() -> None:
    engine = ScoringEngine(FilmmakerProfile(), ScoringWeights())
    opp = Opportunity(
        title="General Creator Program",
        source="Global Media Fund",
        source_type=SourceType.PRIVATE,
        category=OpportunityCategory.FUND,
        url="https://example.org/global",
        description="Funding program for creators. Apply now.",
    )

    difficulty, _confidence, reason = engine.score(opp)

    assert difficulty == 10
    assert reason is not None
    assert "Fails hard gate" in reason
