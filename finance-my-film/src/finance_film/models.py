"""Domain models for film funding opportunities."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal, Self

from pydantic import BaseModel, Field, field_validator, model_validator


class OpportunityCategory(str, Enum):
    """Category of funding opportunity."""

    GRANT = "grant"
    FUND = "fund"
    COMPETITION = "competition"
    INVESTOR = "investor"
    NEWS = "news"
    NETWORKING = "networking"


class OpportunityStatus(str, Enum):
    """Status of an opportunity in the pipeline."""

    NEW = "new"
    REVIEW_PENDING = "review_pending"
    NOTIFIED = "notified"
    APPLIED = "applied"
    REJECTED = "rejected"
    EXPIRED = "expired"


class SourceType(str, Enum):
    """Type of source for the opportunity."""

    GOVERNMENT = "government"
    PROVINCIAL = "provincial"
    MUNICIPAL = "municipal"
    PRIVATE = "private"
    GUILD = "guild"
    ORGANIZATION = "organization"
    NEWS_FEED = "news_feed"
    AI_RESEARCH = "ai_research"


class Opportunity(BaseModel):
    """A film funding opportunity."""

    title: str = Field(min_length=5, max_length=300, description="Opportunity title")
    source: str = Field(min_length=1, max_length=200, description="Source name")
    source_type: SourceType = Field(description="Type of source")
    url: str | None = Field(default=None, max_length=500, description="Opportunity URL")
    amount_cad: float | None = Field(default=None, ge=0, description="Amount in CAD")
    deadline: date | None = Field(default=None, description="Application deadline")
    description: str | None = Field(default=None, max_length=2000, description="Description")
    eligibility: str | None = Field(
        default=None, max_length=1000, description="Eligibility criteria"
    )
    category: OpportunityCategory = Field(description="Opportunity category")
    difficulty_score: int = Field(default=5, ge=1, le=10, description="Difficulty 1-10")
    fit_score: int | None = Field(
        default=None, ge=1, le=10, description="Fit for target profile 1-10"
    )
    confidence_score: float | None = Field(
        default=None, ge=0.0, le=1.0, description="Data confidence 0-1"
    )
    starter_friendly: bool = Field(
        default=False,
        description="Suitable for first-time/emerging filmmakers",
    )
    requires_company: bool = Field(
        default=False,
        description="Requires incorporated company or production entity",
    )
    direct_cash: bool = Field(
        default=True,
        description="Provides direct cash funding/prize (not only tax incentive)",
    )
    rejection_reason: str | None = Field(default=None, description="Why rejected if filtered out")
    status: OpportunityStatus = Field(default=OpportunityStatus.NEW, description="Current status")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not v.startswith(("http://", "https://")):
            msg = "URL must start with http:// or https://"
            raise ValueError(msg)
        return v

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        return " ".join(v.split())


class OpportunityCreate(Opportunity):
    """Data for creating a new opportunity."""

    pass


class OpportunityInDB(Opportunity):
    """Opportunity as stored in database."""

    id: int
    created_at: datetime
    updated_at: datetime | None = None
    notified_at: datetime | None = None

    model_config = {"from_attributes": True}


class Source(BaseModel):
    """A funding source to monitor."""

    name: str = Field(min_length=1, max_length=200, description="Source name")
    url: str = Field(max_length=500, description="Source URL")
    source_type: SourceType = Field(description="Type of source")
    active: bool = Field(default=True, description="Whether to monitor this source")
    last_fetched: datetime | None = Field(default=None, description="Last fetch timestamp")
    fetch_count: int = Field(default=0, ge=0, description="Number of times fetched")
    error_count: int = Field(default=0, ge=0, description="Consecutive error count")
    last_error: str | None = Field(default=None, description="Last error message")


class SourceInDB(Source):
    """Source as stored in database."""

    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RunSummary(BaseModel):
    """Summary of a pipeline run."""

    run_id: str
    started_at: datetime
    finished_at: datetime | None = None
    status: Literal["running", "completed", "failed"] = "running"
    opportunities_found: int = 0
    opportunities_new: int = 0
    opportunities_filtered: int = 0
    opportunities_notified: int = 0
    sources_scanned: int = 0
    errors: list[str] = []
    timing_ms: dict[str, float] = {}


class Digest(BaseModel):
    """A digest of opportunities to send."""

    generated_at: datetime
    opportunities: list[OpportunityInDB]
    total_count: int
    new_count: int

    @model_validator(mode="after")
    def validate_counts(self) -> Self:
        if self.total_count != len(self.opportunities):
            msg = "total_count must match opportunities length"
            raise ValueError(msg)
        return self
