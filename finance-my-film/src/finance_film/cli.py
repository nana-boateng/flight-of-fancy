"""CLI commands for finance-film."""

from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING

import click
import structlog
from rich.console import Console
from rich.table import Table

from finance_film import __version__
from finance_film.config import Settings, get_settings
from finance_film.db.repository import Database
from finance_film.models import OpportunityStatus
from finance_film.notifiers.manager import NotificationManager
from finance_film.pipeline.runner import Pipeline

if TYPE_CHECKING:
    pass

console = Console()


def setup_logging(settings: Settings) -> None:
    """Set up structured logging."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer()
            if not settings.logging.json_format
            else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(__import__("logging"), settings.logging.level)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
    )


@click.group()
@click.version_option(version=__version__, prog_name="finance-film")
@click.option("--config", type=click.Path(exists=True), help="Path to config file")
@click.option("--json", "json_output", is_flag=True, help="Output as JSON")
@click.pass_context
def main(ctx: click.Context, config: str | None, json_output: bool) -> None:
    """Film funding opportunity finder for emerging filmmakers."""
    settings = get_settings()
    setup_logging(settings)

    ctx.ensure_object(dict)
    ctx.obj["settings"] = settings
    ctx.obj["json_output"] = json_output
    ctx.obj["db"] = Database(settings.database.db_path, settings.database.echo_sql)


@main.command()
@click.option("--dry-run", is_flag=True, help="Run without persisting or notifying")
@click.option("--ai/--no-ai", default=None, help="Enable/disable AI research")
@click.pass_context
def scan(ctx: click.Context, dry_run: bool, ai: bool | None) -> None:
    """Run the funding opportunity scan."""
    settings: Settings = ctx.obj["settings"]
    json_output: bool = ctx.obj["json_output"]

    if ai is not None:
        settings.ai.enabled = ai

    async def run_scan() -> None:
        pipeline = Pipeline(settings)
        summary = await pipeline.run()

        if json_output:
            click.echo(json.dumps(summary.model_dump(), default=str, indent=2))
        else:
            console.print("\n[bold green]Scan Complete[/bold green]")
            console.print(f"  Run ID: {summary.run_id}")
            console.print(f"  Status: {summary.status}")
            console.print(f"  Opportunities found: {summary.opportunities_found}")
            console.print(f"  New opportunities: {summary.opportunities_new}")
            console.print(f"  Filtered out: {summary.opportunities_filtered}")
            console.print(f"  Sources scanned: {summary.sources_scanned}")

            if summary.timing_ms:
                console.print("\n[bold]Timing:[/bold]")
                for stage, ms in summary.timing_ms.items():
                    console.print(f"  {stage}: {ms:.0f}ms")

        if not dry_run and settings.notifications.daily_digest:
            opps = pipeline.get_unnotified_opportunities(
                settings.notifications.max_opportunities_per_digest
            )
            if opps:
                notif_manager = NotificationManager(settings.notifications, pipeline.db)
                await notif_manager.send_digest(opps, summary.run_id)
                pipeline.mark_opportunities_notified([o.id for o in opps])
                await notif_manager.close()

    asyncio.run(run_scan())


@main.command("list")
@click.option("--new", "new_only", is_flag=True, help="Show only new opportunities")
@click.option("--limit", default=20, help="Maximum number to show")
@click.option("--min-score", type=int, help="Minimum fit score")
@click.pass_context
def list_opps(
    ctx: click.Context,
    new_only: bool,
    limit: int,
    min_score: int | None,
) -> None:
    """List opportunities from database."""
    settings: Settings = ctx.obj["settings"]
    db: Database = ctx.obj["db"]
    json_output: bool = ctx.obj["json_output"]

    db.create_tables()

    with db.get_session() as session:
        from sqlalchemy import select

        from finance_film.db.models import OpportunityDB

        stmt = select(OpportunityDB).order_by(
            OpportunityDB.fit_score.desc().nullslast(),
            OpportunityDB.difficulty_score.asc(),
            OpportunityDB.created_at.desc(),
        )

        if new_only:
            stmt = stmt.where(OpportunityDB.status == "new")

        if min_score:
            stmt = stmt.where(OpportunityDB.fit_score >= min_score)

        stmt = stmt.limit(limit)
        results = session.execute(stmt).scalars().all()

        if json_output:
            data = [
                {
                    "id": o.id,
                    "title": o.title,
                    "source": o.source,
                    "category": o.category,
                    "status": o.status,
                    "amount": o.amount_cad,
                    "fit_score": o.fit_score,
                    "difficulty": o.difficulty_score,
                    "starter_friendly": o.starter_friendly,
                    "requires_company": o.requires_company,
                    "direct_cash": o.direct_cash,
                    "url": o.url,
                    "created_at": str(o.created_at),
                }
                for o in results
            ]
            click.echo(json.dumps(data, indent=2))
        else:
            table = Table(title="Film Funding Opportunities")
            table.add_column("ID", style="dim")
            table.add_column("Title", max_width=40)
            table.add_column("Source", max_width=20)
            table.add_column("Category")
            table.add_column("Amount")
            table.add_column("Fit")
            table.add_column("Diff")
            table.add_column("Status")
            table.add_column("Labels", max_width=28)

            for o in results:
                labels = ",".join(
                    [
                        "starter" if o.starter_friendly else "not-starter",
                        "company" if o.requires_company else "individual",
                        "cash" if o.direct_cash else "non-cash",
                    ]
                )
                table.add_row(
                    str(o.id),
                    o.title[:40],
                    o.source[:20],
                    o.category,
                    f"${o.amount_cad:,.0f}" if o.amount_cad else "-",
                    str(o.fit_score) if o.fit_score else "-",
                    str(o.difficulty_score),
                    o.status,
                    labels,
                )

            console.print(table)


def _parse_id_list(raw: str | None) -> list[int]:
    if not raw:
        return []
    ids: list[int] = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        ids.append(int(token))
    return ids


@main.command()
@click.option("--limit", default=25, help="Maximum pending opportunities to display")
@click.option("--approve", help="Comma-separated IDs to approve")
@click.option("--reject", help="Comma-separated IDs to reject")
@click.option("--all-approve", is_flag=True, help="Approve all pending opportunities")
@click.pass_context
def review(
    ctx: click.Context,
    limit: int,
    approve: str | None,
    reject: str | None,
    all_approve: bool,
) -> None:
    """Review borderline opportunities before notification."""
    db: Database = ctx.obj["db"]
    json_output: bool = ctx.obj["json_output"]

    approve_ids = _parse_id_list(approve)
    reject_ids = _parse_id_list(reject)

    db.create_tables()
    with db.get_session() as session:
        pending = db.get_review_pending_opportunities(session, limit)

        if all_approve and pending:
            approve_ids = [o.id for o in pending]

        approved_count = db.update_opportunity_status(session, approve_ids, OpportunityStatus.NEW)
        rejected_count = db.update_opportunity_status(
            session, reject_ids, OpportunityStatus.REJECTED
        )

        for opp_id in reject_ids:
            db.record_rejection(session, opp_id, "Rejected during manual review", "manual_review")

        if approved_count or rejected_count:
            session.commit()

        remaining = db.get_review_pending_opportunities(session, limit)

    if json_output:
        click.echo(
            json.dumps(
                {
                    "approved": approved_count,
                    "rejected": rejected_count,
                    "remaining": len(remaining),
                    "pending_ids": [o.id for o in remaining],
                },
                indent=2,
            )
        )
        return

    console.print("\n[bold]Review Queue[/bold]")
    console.print(f"  Approved: {approved_count}")
    console.print(f"  Rejected: {rejected_count}")
    console.print(f"  Remaining: {len(remaining)}")

    if not remaining:
        console.print("  No opportunities pending review")
        return

    table = Table(title="Pending Review")
    table.add_column("ID", style="dim")
    table.add_column("Title", max_width=45)
    table.add_column("Source", max_width=24)
    table.add_column("Fit")
    table.add_column("Conf")
    table.add_column("Labels", max_width=28)

    for o in remaining:
        labels = ",".join(
            [
                "starter" if o.starter_friendly else "not-starter",
                "company" if o.requires_company else "individual",
                "cash" if o.direct_cash else "non-cash",
            ]
        )
        table.add_row(
            str(o.id),
            o.title[:45],
            o.source[:24],
            str(o.fit_score) if o.fit_score else "-",
            f"{o.confidence_score:.2f}" if o.confidence_score is not None else "-",
            labels,
        )

    console.print(table)


@main.command()
@click.option("--limit", default=15, help="Maximum opportunities in digest")
@click.pass_context
def notify(ctx: click.Context, limit: int) -> None:
    """Send notification digest of unnotified opportunities."""
    settings: Settings = ctx.obj["settings"]
    json_output: bool = ctx.obj["json_output"]

    async def send_notifications() -> None:
        pipeline = Pipeline(settings)
        opps = pipeline.get_unnotified_opportunities(limit)

        if not opps:
            if json_output:
                click.echo(json.dumps({"message": "No new opportunities to notify"}))
            else:
                console.print("[yellow]No new opportunities to notify[/yellow]")
            return

        notif_manager = NotificationManager(settings.notifications, pipeline.db)
        results = await notif_manager.send_digest(opps)

        if json_output:
            click.echo(json.dumps({"channels": results, "count": len(opps)}))
        else:
            console.print(f"\n[bold]Sent digest with {len(opps)} opportunities[/bold]")
            for channel, success in results.items():
                status = "[green]OK[/green]" if success else "[red]FAILED[/red]"
                console.print(f"  {channel}: {status}")

        pipeline.mark_opportunities_notified([o.id for o in opps])
        await notif_manager.close()

    asyncio.run(send_notifications())


@main.command()
@click.pass_context
def health(ctx: click.Context) -> None:
    """Check system health."""
    settings: Settings = ctx.obj["settings"]
    db: Database = ctx.obj["db"]
    json_output: bool = ctx.obj["json_output"]

    health_status: dict[str, str | int] = {
        "status": "healthy",
        "version": __version__,
        "database": "ok",
        "ntfy": "not configured",
        "ai": "disabled",
    }

    try:
        db.create_tables()
        with db.get_session() as session:
            from sqlalchemy import select

            from finance_film.db.models import InvestorRegistryDB

            count = db.count_opportunities(session)
            health_status["opportunities_count"] = count
            investor_count = len(
                list(session.execute(select(InvestorRegistryDB.id)).scalars().all())
            )
            health_status["investor_registry_count"] = investor_count
    except Exception as e:
        health_status["database"] = f"error: {e}"
        health_status["status"] = "unhealthy"

    if settings.notifications.ntfy_url and settings.notifications.ntfy_topic:
        health_status["ntfy"] = "configured"

    if settings.ai.enabled:
        health_status["ai"] = f"enabled ({settings.ai.provider})"

    if json_output:
        click.echo(json.dumps(health_status, indent=2))
    else:
        console.print("\n[bold]Finance Film Health Check[/bold]\n")
        for key, value in health_status.items():
            if key == "status":
                color = "green" if value == "healthy" else "red"
                console.print(f"  {key}: [{color}]{value}[/{color}]")
            else:
                console.print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
