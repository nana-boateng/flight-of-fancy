"""Main pipeline orchestrator."""

from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

import structlog

from finance_film.config import Settings, get_settings
from finance_film.db.repository import Database
from finance_film.models import (
    Opportunity,
    OpportunityInDB,
    OpportunityStatus,
    RunSummary,
    Source,
    SourceInDB,
    SourceType,
)
from finance_film.pipeline.dedup import deduplicate_within_list
from finance_film.pipeline.scoring import ScoringEngine
from finance_film.sources.ai_provider import AIProviderAdapter, get_ai_source
from finance_film.sources.base import SourceAdapter
from finance_film.sources.http_client import HTTPClient
from finance_film.sources.rss import RSSSourceAdapter, get_default_rss_sources
from finance_film.sources.web import WebSourceAdapter, get_default_web_sources

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()


class Pipeline:
    """Main pipeline for collecting and processing opportunities."""

    def __init__(
        self,
        settings: Settings | None = None,
        db: Database | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.db = db or Database(self.settings.database.db_path, self.settings.database.echo_sql)
        self.scoring_engine = ScoringEngine(
            self.settings.filmmaker,
            self.settings.scoring,
        )
        self._http_client: HTTPClient | None = None

    async def run(self) -> RunSummary:
        """Execute a full pipeline run."""
        run_id = self._generate_run_id()
        started_at = datetime.utcnow()
        timing: dict[str, float] = {}

        logger.info("pipeline_start", run_id=run_id)

        self.db.create_tables()

        with self.db.get_session() as session:
            run_summary = self.db.create_run(session, run_id)
            self.db.seed_verified_investors(session)
            session.commit()

        try:
            with self.db.get_session() as session:
                existing_urls = self._get_existing_urls(session)
                existing_titles = self._get_existing_titles(session)

            all_opportunities: list[Opportunity] = []

            t0 = time.monotonic()
            async with HTTPClient(self.settings.http) as http_client:
                self._http_client = http_client

                sources = self._get_sources(http_client)
                source_results = await self._fetch_all_sources(sources)

                for src_id, (source, opps, success, error) in source_results.items():
                    all_opportunities.extend(opps)
                    with self.db.get_session() as session:
                        self.db.update_source_fetch(
                            session,
                            source.id,
                            success=success,
                            error=error,
                        )
                        session.commit()

            timing["fetch"] = (time.monotonic() - t0) * 1000

            t0 = time.monotonic()
            deduped = deduplicate_within_list(all_opportunities)
            timing["dedup"] = (time.monotonic() - t0) * 1000

            t0 = time.monotonic()
            scored, filtered = self._score_opportunities(deduped)
            timing["score"] = (time.monotonic() - t0) * 1000

            t0 = time.monotonic()
            new_count = self._persist_opportunities(scored, existing_urls, existing_titles)
            timing["persist"] = (time.monotonic() - t0) * 1000

            with self.db.get_session() as session:
                run_summary.finished_at = datetime.utcnow()
                run_summary.status = "completed"
                run_summary.opportunities_found = len(all_opportunities)
                run_summary.opportunities_new = new_count
                run_summary.opportunities_filtered = len(filtered)
                run_summary.sources_scanned = len(sources)
                run_summary.timing_ms = timing
                self.db.update_run(session, run_summary)
                session.commit()

            logger.info(
                "pipeline_complete",
                run_id=run_id,
                found=len(all_opportunities),
                new=new_count,
                filtered=len(filtered),
            )

            return run_summary

        except Exception as e:
            logger.error("pipeline_error", run_id=run_id, error=str(e))
            with self.db.get_session() as session:
                run_summary.finished_at = datetime.utcnow()
                run_summary.status = "failed"
                run_summary.errors = [str(e)]
                self.db.update_run(session, run_summary)
                session.commit()
            raise

    async def _fetch_all_sources(
        self, sources: list[tuple[SourceInDB, SourceAdapter]]
    ) -> dict[int, tuple[SourceInDB, list[Opportunity], bool, str | None]]:
        """Fetch from all sources concurrently."""
        import asyncio

        results: dict[int, tuple[SourceInDB, list[Opportunity], bool, str | None]] = {}

        async def fetch_one(
            source: SourceInDB, adapter: SourceAdapter
        ) -> tuple[int, SourceInDB, list[Opportunity], bool, str | None]:
            try:
                opps = await adapter.fetch()
                return source.id, source, opps, True, None
            except Exception as e:
                logger.error("source_fetch_error", source=source.name, error=str(e))
                return source.id, source, [], False, str(e)

        tasks = [fetch_one(src, adapter) for src, adapter in sources]
        results_list = await asyncio.gather(*tasks)
        for src_id, src, opps, success, error in results_list:
            results[src_id] = (src, opps, success, error)

        return results

    def _get_sources(self, http_client: HTTPClient) -> list[tuple[SourceInDB, SourceAdapter]]:
        """Get all configured sources with their adapters."""
        sources: list[tuple[SourceInDB, SourceAdapter]] = []

        with self.db.get_session() as session:
            for source in get_default_web_sources():
                db_source = self.db.insert_source(session, source)
                sources.append((db_source, WebSourceAdapter(db_source, http_client)))

            for source in get_default_rss_sources():
                db_source = self.db.insert_source(session, source)
                sources.append((db_source, RSSSourceAdapter(db_source, http_client)))

            if self.settings.ai.enabled:
                ai_source = get_ai_source(self.settings.ai)
                db_source = self.db.insert_source(session, ai_source)
                sources.append((db_source, AIProviderAdapter(db_source, self.settings.ai)))

            session.commit()

        return sources

    def _score_opportunities(
        self, opportunities: list[Opportunity]
    ) -> tuple[list[Opportunity], list[Opportunity]]:
        """Score opportunities and filter out rejected ones."""
        scored: list[Opportunity] = []
        filtered: list[Opportunity] = []

        for opp in opportunities:
            difficulty, confidence, rejection = self.scoring_engine.score(opp)

            opp.difficulty_score = difficulty
            opp.confidence_score = confidence
            opp.rejection_reason = rejection

            if rejection or difficulty > 7:
                opp.rejection_reason = rejection or "Difficulty too high"
                opp.status = OpportunityStatus.REJECTED
                filtered.append(opp)
            else:
                opp.fit_score = self.scoring_engine.calculate_fit_score(opp)
                if (opp.fit_score or 0) <= 6 or (opp.confidence_score or 0.0) < 0.8:
                    opp.status = OpportunityStatus.REVIEW_PENDING
                else:
                    opp.status = OpportunityStatus.NEW
                scored.append(opp)

        scored.sort(key=lambda o: (-(o.fit_score or 0), o.difficulty_score))
        return scored, filtered

    def _persist_opportunities(
        self,
        opportunities: list[Opportunity],
        existing_urls: set[str],
        existing_titles: set[str],
    ) -> int:
        """Persist opportunities to database."""
        new_count = 0

        with self.db.get_session() as session:
            for opp in opportunities:
                if opp.url and opp.url in existing_urls:
                    continue

                norm_title = opp.title.lower().strip()
                if norm_title in existing_titles:
                    continue

                existing = self.db.get_opportunity_by_title_source(session, opp.title, opp.source)
                if existing:
                    continue

                self.db.insert_opportunity(session, opp)
                new_count += 1
                existing_titles.add(norm_title)
                if opp.url:
                    existing_urls.add(opp.url)

            session.commit()

        return new_count

    def _get_existing_urls(self, session: Any) -> set[str]:
        """Get set of existing URLs from database."""
        from sqlalchemy import select

        from finance_film.db.models import OpportunityDB

        stmt = select(OpportunityDB.url).where(OpportunityDB.url.isnot(None))
        return set(session.execute(stmt).scalars().all())

    def _get_existing_titles(self, session: Any) -> set[str]:
        """Get set of existing normalized titles from database."""
        from sqlalchemy import select

        from finance_film.db.models import OpportunityDB

        stmt = select(OpportunityDB.title, OpportunityDB.source)
        results = session.execute(stmt).all()
        return {f"{t.lower().strip()}:{s}" for t, s in results}

    def _generate_run_id(self) -> str:
        """Generate a unique run ID."""
        return f"run-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"

    def get_unnotified_opportunities(self, limit: int = 15) -> list[OpportunityInDB]:
        """Get unnotified opportunities for digest."""
        with self.db.get_session() as session:
            return self.db.get_unnotified_opportunities(session, limit)

    def mark_opportunities_notified(self, opp_ids: list[int]) -> int:
        """Mark opportunities as notified."""
        with self.db.get_session() as session:
            count = self.db.mark_opportunities_notified(session, opp_ids)
            session.commit()
            return count
