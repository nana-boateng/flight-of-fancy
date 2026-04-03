"""Database repository for CRUD operations."""

from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from finance_film.db.models import (
    Base,
    InvestorRegistryDB,
    NotificationDB,
    OpportunityDB,
    RejectionDB,
    RunDB,
    SourceDB,
    create_engine_from_path,
)
from finance_film.models import (
    Opportunity,
    OpportunityCategory,
    OpportunityInDB,
    OpportunityStatus,
    RunSummary,
    Source,
    SourceInDB,
    SourceType,
)

if TYPE_CHECKING:
    from pathlib import Path


class Database:
    """Database manager with repository methods."""

    def __init__(self, db_path: Path | str, echo: bool = False) -> None:
        self.engine = create_engine_from_path(str(db_path), echo=echo)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def create_tables(self) -> None:
        """Create all tables."""
        Base.metadata.create_all(self.engine)

    def drop_tables(self) -> None:
        """Drop all tables (for testing)."""
        Base.metadata.drop_all(self.engine)

    def get_session(self) -> Session:
        """Get a new session."""
        return self.session_factory()

    # --- Opportunities ---

    def insert_opportunity(self, session: Session, opp: Opportunity) -> OpportunityInDB:
        """Insert a new opportunity."""
        db_opp = OpportunityDB(
            title=opp.title,
            source=opp.source,
            source_type=opp.source_type.value,
            url=opp.url,
            amount_cad=opp.amount_cad,
            deadline=opp.deadline,
            description=opp.description,
            eligibility=opp.eligibility,
            category=opp.category.value,
            difficulty_score=opp.difficulty_score,
            fit_score=opp.fit_score,
            confidence_score=opp.confidence_score,
            starter_friendly=opp.starter_friendly,
            requires_company=opp.requires_company,
            direct_cash=opp.direct_cash,
            rejection_reason=opp.rejection_reason,
            status=opp.status.value,
        )
        session.add(db_opp)
        session.flush()
        return self._to_opportunity_in_db(db_opp)

    def insert_opportunities(
        self, session: Session, opps: list[Opportunity]
    ) -> list[OpportunityInDB]:
        """Insert multiple opportunities."""
        return [self.insert_opportunity(session, opp) for opp in opps]

    def get_opportunity_by_id(self, session: Session, opp_id: int) -> OpportunityInDB | None:
        """Get opportunity by ID."""
        db_opp = session.get(OpportunityDB, opp_id)
        return self._to_opportunity_in_db(db_opp) if db_opp else None

    def get_opportunity_by_title_source(
        self, session: Session, title: str, source: str
    ) -> OpportunityInDB | None:
        """Get opportunity by title and source."""
        stmt = select(OpportunityDB).where(
            OpportunityDB.title == title,
            OpportunityDB.source == source,
        )
        db_opp = session.execute(stmt).scalar_one_or_none()
        return self._to_opportunity_in_db(db_opp) if db_opp else None

    def get_opportunity_by_url(self, session: Session, url: str) -> OpportunityInDB | None:
        """Get opportunity by URL."""
        if not url:
            return None
        stmt = select(OpportunityDB).where(OpportunityDB.url == url)
        db_opp = session.execute(stmt).scalar_one_or_none()
        return self._to_opportunity_in_db(db_opp) if db_opp else None

    def get_unnotified_opportunities(
        self, session: Session, limit: int = 15
    ) -> list[OpportunityInDB]:
        """Get unnotified opportunities ordered by fit/difficulty."""
        stmt = (
            select(OpportunityDB)
            .where(OpportunityDB.status == OpportunityStatus.NEW.value)
            .order_by(
                OpportunityDB.fit_score.desc().nullslast(),
                OpportunityDB.difficulty_score.asc(),
                OpportunityDB.created_at.desc(),
            )
            .limit(limit)
        )
        results = session.execute(stmt).scalars().all()
        return [self._to_opportunity_in_db(o) for o in results]

    def mark_opportunities_notified(self, session: Session, opp_ids: list[int]) -> int:
        """Mark opportunities as notified."""
        if not opp_ids:
            return 0
        now = datetime.utcnow()
        count = 0
        for opp_id in opp_ids:
            db_opp = session.get(OpportunityDB, opp_id)
            if db_opp:
                db_opp.status = OpportunityStatus.NOTIFIED.value
                db_opp.notified_at = now
                db_opp.updated_at = now
                count += 1
        return count

    def count_opportunities(self, session: Session) -> int:
        """Count total opportunities."""
        stmt = select(OpportunityDB.id)
        return len(list(session.execute(stmt).scalars().all()))

    def count_unnotified(self, session: Session) -> int:
        """Count unnotified opportunities."""
        stmt = select(OpportunityDB.id).where(OpportunityDB.status == OpportunityStatus.NEW.value)
        return len(list(session.execute(stmt).scalars().all()))

    def get_review_pending_opportunities(
        self, session: Session, limit: int = 25
    ) -> list[OpportunityInDB]:
        """Get opportunities waiting for manual review."""
        stmt = (
            select(OpportunityDB)
            .where(OpportunityDB.status == OpportunityStatus.REVIEW_PENDING.value)
            .order_by(
                OpportunityDB.fit_score.desc().nullslast(),
                OpportunityDB.created_at.desc(),
            )
            .limit(limit)
        )
        results = session.execute(stmt).scalars().all()
        return [self._to_opportunity_in_db(o) for o in results]

    def update_opportunity_status(
        self, session: Session, opp_ids: list[int], status: OpportunityStatus
    ) -> int:
        """Bulk update opportunity status."""
        if not opp_ids:
            return 0
        count = 0
        for opp_id in opp_ids:
            db_opp = session.get(OpportunityDB, opp_id)
            if db_opp:
                db_opp.status = status.value
                db_opp.updated_at = datetime.utcnow()
                count += 1
        return count

    # --- Sources ---

    def insert_source(self, session: Session, source: Source) -> SourceInDB:
        """Insert a new source or get existing one."""
        existing = session.execute(
            select(SourceDB).where(SourceDB.name == source.name)
        ).scalar_one_or_none()
        if existing:
            return self._to_source_in_db(existing)

        db_source = SourceDB(
            name=source.name,
            url=source.url,
            source_type=source.source_type.value,
            active=source.active,
        )
        session.add(db_source)
        session.flush()
        return self._to_source_in_db(db_source)

    def get_active_sources(self, session: Session) -> list[SourceInDB]:
        """Get all active sources."""
        stmt = select(SourceDB).where(SourceDB.active == True)
        results = session.execute(stmt).scalars().all()
        return [self._to_source_in_db(s) for s in results]

    def update_source_fetch(
        self,
        session: Session,
        source_id: int,
        success: bool,
        error: str | None = None,
    ) -> None:
        """Update source after fetch attempt."""
        db_source = session.get(SourceDB, source_id)
        if db_source:
            db_source.last_fetched = datetime.utcnow()
            db_source.fetch_count += 1
            if success:
                db_source.error_count = 0
                db_source.last_error = None
            else:
                db_source.error_count += 1
                db_source.last_error = error

    # --- Runs ---

    def create_run(self, session: Session, run_id: str) -> RunSummary:
        """Create a new run record."""
        db_run = RunDB(
            run_id=run_id,
            started_at=datetime.utcnow(),
            status="running",
        )
        session.add(db_run)
        session.flush()
        return self._to_run_summary(db_run)

    def update_run(self, session: Session, summary: RunSummary) -> None:
        """Update run record."""
        db_run = session.execute(
            select(RunDB).where(RunDB.run_id == summary.run_id)
        ).scalar_one_or_none()
        if db_run:
            db_run.finished_at = summary.finished_at
            db_run.status = summary.status
            db_run.opportunities_found = summary.opportunities_found
            db_run.opportunities_new = summary.opportunities_new
            db_run.opportunities_filtered = summary.opportunities_filtered
            db_run.opportunities_notified = summary.opportunities_notified
            db_run.sources_scanned = summary.sources_scanned
            db_run.errors = json.dumps(summary.errors) if summary.errors else None
            db_run.timing_ms = json.dumps(summary.timing_ms) if summary.timing_ms else None

    # --- Notifications ---

    def record_notification(
        self,
        session: Session,
        run_id: str,
        channel: str,
        success: bool,
        opportunity_count: int,
        error: str | None = None,
    ) -> None:
        """Record a notification attempt."""
        notif = NotificationDB(
            run_id=run_id,
            channel=channel,
            success=success,
            opportunity_count=opportunity_count,
            error_message=error,
        )
        session.add(notif)

    # --- Rejections ---

    def record_rejection(
        self,
        session: Session,
        opportunity_id: int,
        reason: str,
        stage: str,
    ) -> None:
        """Record why an opportunity was rejected."""
        rejection = RejectionDB(
            opportunity_id=opportunity_id,
            reason=reason,
            stage=stage,
        )
        session.add(rejection)

    # --- Investor registry ---

    def seed_verified_investors(self, session: Session) -> int:
        """Seed verified investor registry entries if missing."""
        seed_data = [
            {
                "name": "The Talent Fund",
                "website": "https://thetalentfund.ca/",
                "min_ticket_cad": 5000,
                "max_ticket_cad": 50000,
                "evidence": "Funds emerging Canadian filmmakers and debut projects",
                "notes": "Known for backing early-career creators",
            },
            {
                "name": "Rogers Documentary Fund",
                "website": "https://www.rogersgroupoffunds.com/tell-me-more/funds/documentary-fund/",
                "min_ticket_cad": 5000,
                "max_ticket_cad": 25000,
                "evidence": "Supports documentary projects including short-format pathways",
                "notes": "Strong Canadian track record",
            },
            {
                "name": "NFB Filmmaker Assistance Program",
                "website": "https://production.nfbonf.ca/en/filmmaker-assistance-program-fap/",
                "min_ticket_cad": 1000,
                "max_ticket_cad": 15000,
                "evidence": "Provides direct support to filmmakers in development/production",
                "notes": "Public institution, beginner-accessible entry path",
            },
        ]

        inserted = 0
        for item in seed_data:
            existing = session.execute(
                select(InvestorRegistryDB).where(InvestorRegistryDB.name == item["name"])
            ).scalar_one_or_none()
            if existing:
                continue
            session.add(
                InvestorRegistryDB(
                    name=item["name"],
                    website=item["website"],
                    min_ticket_cad=item["min_ticket_cad"],
                    max_ticket_cad=item["max_ticket_cad"],
                    focus_short_films=True,
                    evidence=item["evidence"],
                    notes=item["notes"],
                    active=True,
                )
            )
            inserted += 1
        return inserted

    # --- Conversions ---

    def _to_opportunity_in_db(self, db_opp: OpportunityDB) -> OpportunityInDB:
        return OpportunityInDB(
            id=db_opp.id,
            title=db_opp.title,
            source=db_opp.source,
            source_type=SourceType(db_opp.source_type),
            url=db_opp.url,
            amount_cad=db_opp.amount_cad,
            deadline=db_opp.deadline,
            description=db_opp.description,
            eligibility=db_opp.eligibility,
            category=OpportunityCategory(db_opp.category),
            difficulty_score=db_opp.difficulty_score,
            fit_score=db_opp.fit_score,
            confidence_score=db_opp.confidence_score,
            starter_friendly=db_opp.starter_friendly,
            requires_company=db_opp.requires_company,
            direct_cash=db_opp.direct_cash,
            rejection_reason=db_opp.rejection_reason,
            status=OpportunityStatus(db_opp.status),
            created_at=db_opp.created_at,
            updated_at=db_opp.updated_at,
            notified_at=db_opp.notified_at,
        )

    def _to_source_in_db(self, db_source: SourceDB) -> SourceInDB:
        return SourceInDB(
            id=db_source.id,
            name=db_source.name,
            url=db_source.url,
            source_type=SourceType(db_source.source_type),
            active=db_source.active,
            last_fetched=db_source.last_fetched,
            fetch_count=db_source.fetch_count,
            error_count=db_source.error_count,
            last_error=db_source.last_error,
            created_at=db_source.created_at,
        )

    def _to_run_summary(self, db_run: RunDB) -> RunSummary:
        return RunSummary(
            run_id=db_run.run_id,
            started_at=db_run.started_at,
            finished_at=db_run.finished_at,
            status=db_run.status,  # type: ignore[arg-type]
            opportunities_found=db_run.opportunities_found,
            opportunities_new=db_run.opportunities_new,
            opportunities_filtered=db_run.opportunities_filtered,
            opportunities_notified=db_run.opportunities_notified,
            sources_scanned=db_run.sources_scanned,
            errors=json.loads(db_run.errors) if db_run.errors else [],
            timing_ms=json.loads(db_run.timing_ms) if db_run.timing_ms else {},
        )
