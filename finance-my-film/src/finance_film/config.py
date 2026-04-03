"""Typed configuration with validation and secrets handling."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class FilmmakerProfile(BaseSettings):
    """Target filmmaker profile for opportunity matching."""

    target_amount_cad: int = Field(default=30_000, ge=0, description="Target funding amount in CAD")
    location: str = Field(default="Toronto, Ontario, Canada", description="Geographic focus")
    audience: str = Field(default="emerging_filmmakers", description="Target audience type")
    max_budget_cad: int = Field(
        default=50_000, ge=0, description="Maximum project budget considered relevant"
    )


class NotificationSettings(BaseSettings):
    """Notification channel configuration."""

    ntfy_url: str | None = Field(default=None, description="ntfy server URL")
    ntfy_topic: str | None = Field(default=None, description="ntfy topic name")
    file_log_path: Path = Field(
        default=Path("funding_opportunities.log"), description="Log file path"
    )
    daily_digest: bool = Field(default=True, description="Send daily digest")
    digest_time: str = Field(
        default="09:00", pattern=r"^\d{2}:\d{2}$", description="Digest time HH:MM"
    )
    max_opportunities_per_digest: int = Field(
        default=15, ge=1, le=50, description="Max items in digest"
    )

    @model_validator(mode="after")
    def validate_ntfy_config(self) -> NotificationSettings:
        if (self.ntfy_url is None) != (self.ntfy_topic is None):
            msg = "Both ntfy_url and ntfy_topic must be set together, or both unset"
            raise ValueError(msg)
        return self


class HTTPSettings(BaseSettings):
    """HTTP client configuration."""

    timeout_seconds: float = Field(default=15.0, ge=1.0, le=60.0, description="Request timeout")
    max_retries: int = Field(default=3, ge=0, le=5, description="Max retry attempts")
    retry_backoff_factor: float = Field(
        default=2.0, ge=1.0, le=5.0, description="Exponential backoff factor"
    )
    rate_limit_delay: float = Field(
        default=1.0, ge=0.0, le=10.0, description="Delay between requests to same host"
    )
    max_concurrent: int = Field(default=5, ge=1, le=20, description="Max concurrent requests")
    user_agent: str = Field(
        default="FinanceFilm/2.0 (Film Funding Research Bot)",
        description="User-Agent header",
    )


class ScoringWeights(BaseSettings):
    """Weights for opportunity scoring algorithm."""

    emerging_keywords: float = Field(
        default=2.0, description="Weight for emerging filmmaker keywords"
    )
    location_match: float = Field(default=1.5, description="Weight for location relevance")
    amount_fit: float = Field(default=1.0, description="Weight for amount within target range")
    deadline_proximity: float = Field(default=0.5, description="Weight for deadline urgency")
    source_reliability: float = Field(default=1.0, description="Weight for source trustworthiness")


class AIProviderSettings(BaseSettings):
    """AI provider configuration (optional)."""

    enabled: bool = Field(default=False, description="Enable AI-powered research")
    provider: Literal["opencode"] = Field(default="opencode", description="AI provider name")
    model: str | None = Field(default=None, description="Model identifier")
    timeout_seconds: int = Field(default=120, ge=30, le=600, description="AI request timeout")
    max_retries: int = Field(default=2, ge=0, le=3, description="Max AI request retries")


class DatabaseSettings(BaseSettings):
    """Database configuration."""

    db_path: Path = Field(default=Path("film_finance.db"), description="SQLite database path")
    echo_sql: bool = Field(default=False, description="Echo SQL statements (debug)")

    @model_validator(mode="after")
    def resolve_path(self) -> DatabaseSettings:
        if not self.db_path.is_absolute():
            self.db_path = Path.cwd() / self.db_path
        return self


class LoggingSettings(BaseSettings):
    """Logging configuration."""

    level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO", description="Log level"
    )
    file_path: Path | None = Field(default=Path("film_finance.log"), description="Log file path")
    json_format: bool = Field(default=False, description="Use JSON log format")


class Settings(BaseSettings):
    """Application settings loaded from environment and .env file."""

    model_config = SettingsConfigDict(
        env_file="/root/flight-of-fancy/finance-my-film/.env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    filmmaker: FilmmakerProfile = Field(default_factory=FilmmakerProfile)
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    http: HTTPSettings = Field(default_factory=HTTPSettings)
    scoring: ScoringWeights = Field(default_factory=ScoringWeights)
    ai: AIProviderSettings = Field(default_factory=AIProviderSettings)
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def clear_settings_cache() -> None:
    """Clear settings cache (for testing)."""
    get_settings.cache_clear()
