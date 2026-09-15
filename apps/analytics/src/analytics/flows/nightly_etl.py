"""Nightly Gold pipeline and PostgreSQL serving publication flow."""

import logging
import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# Ensure ``src`` is on sys.path for remote runners.
src_path = str(Path(__file__).resolve().parents[2])
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from prefect import flow  # noqa: E402
from prefect.exceptions import MissingContextError  # noqa: E402
from prefect.logging import get_run_logger  # noqa: E402

from analytics.completeness import get_pending_dates, get_reopen_candidates  # noqa: E402
from analytics.config import get_settings  # noqa: E402
from analytics.gaps import POSTHOG_SOURCE, GapRecord, PostgresGapRepository  # noqa: E402
from analytics.serving import PostgresServingRepository, sync_gold_to_postgres  # noqa: E402
from analytics.tasks.axiom import pull_axiom_logs  # noqa: E402
from analytics.tasks.posthog import (  # noqa: E402
    PostHogDelivery,
    SourceState,
    check_posthog_files,
)
from analytics.tasks.transform import (  # noqa: E402
    transform_bronze_to_silver,
    transform_silver_to_gold,
)

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")
logger = logging.getLogger(__name__)


def _delivery_state(delivery: PostHogDelivery | bool) -> PostHogDelivery:
    """Keep the flow compatible with simple task doubles used by operators/tests."""
    if isinstance(delivery, PostHogDelivery):
        return delivery
    return PostHogDelivery(SourceState.DATA if delivery else SourceState.PENDING)


def _posthog_path(settings, current_date: date) -> str:
    return (
        f"s3://{settings.R2_BUCKET_NAME}/bronze/posthog/"
        f"{current_date.year:04d}/{current_date.month:02d}/"
        f"{current_date.day:02d}/*.parquet*"
    )


def _delivery_for(
    current_date: date,
    settings,
    *,
    use_verifier: bool = True,
) -> PostHogDelivery:
    return _delivery_state(
        check_posthog_files(
            target_date=current_date,
            path=_posthog_path(settings, current_date),
            settings=settings,
            use_verifier=use_verifier,
        )
    )


def _process_date(
    current_date: date,
    delivery: PostHogDelivery,
    settings,
    repository: PostgresServingRepository,
) -> None:
    axiom_available = pull_axiom_logs(target_date=current_date, settings=settings) is not None
    if axiom_available:
        transform_bronze_to_silver(target_date=current_date, settings=settings)
    transform_silver_to_gold(
        target_date=current_date,
        settings=settings,
        posthog_bronze_path=_posthog_path(settings, current_date),
        posthog_status=delivery.state,
    )
    sync_gold_to_postgres(
        target_date=current_date,
        settings=settings,
        repository=repository,
        authoritative_empty=delivery.state is SourceState.EMPTY,
    )


def _reopen_logger():
    """Prefer the Prefect run logger so the reopen audit reaches run history."""
    try:
        return get_run_logger()
    except MissingContextError:
        return logger


def _reopen_gap(
    gap: GapRecord,
    delivery: PostHogDelivery,
    gap_repository: PostgresGapRepository,
) -> None:
    """Clear the Terminal Gap and record the late arrival for audit.

    The log record carries the cleared decision's reason and decision time,
    the source evidence that reopened it, and the reopen time; it goes to the
    Prefect run history, which is where the run/error record lives (ADR-0008).
    """
    if not gap_repository.clear_gap(gap.date, gap.source):
        return
    _reopen_logger().info(
        "Reopened terminal gap: date=%s source=%s reason=%r decided_at=%s "
        "source_state=%s reopened_at=%s",
        gap.date,
        gap.source,
        gap.reason,
        gap.decided_at,
        delivery.state,
        datetime.now(UTC),
    )


def _handle_pending_source(
    current_date: date,
    target_date: date,
    settings,
    gap_repository: PostgresGapRepository,
) -> None:
    """Warn while inside the lateness window; record one Terminal Gap past it."""
    pending_age = (target_date - current_date).days
    if pending_age >= settings.POSTHOG_ABANDON_AFTER_DAYS:
        gap_repository.record_gap(
            current_date,
            POSTHOG_SOURCE,
            (
                f"auto-abandoned after {pending_age} days pending "
                f"(no PostHog export; abandon threshold "
                f"{settings.POSTHOG_ABANDON_AFTER_DAYS} days)"
            ),
        )
        logger.warning(
            "PostHog export missing: date=%s age=%sd, recorded terminal gap",
            current_date,
            pending_age,
        )
    elif pending_age >= settings.POSTHOG_WARN_AFTER_DAYS:
        logger.warning(
            "PostHog export missing: date=%s age=%sd, still retrying",
            current_date,
            pending_age,
        )


@flow(name="nightly-etl-flow")
def nightly_etl_flow(target_date: date | None = None) -> date:
    """Publish every unaccounted-for date whose sources are complete.

    A date is done when it is in the serving snapshot or the Gap Ledger, so
    those dates are never retried. A missing PostHog export warns while it is
    inside the lateness window and is recorded once as a Terminal Gap past the
    abandon threshold; either way it never blocks a newer date. Every recorded
    gap is re-checked for a late source arrival, reopening only on arrived
    export files or an operator-attested empty date -- never on a file-less
    source count, which cannot be told apart from aged-out retention. A
    reopened gap is cleared (logged for audit) and the date is reprocessed
    through the normal idempotent path, ending served or re-gapped. Completion
    comes from the artifacts rather than a per-stage status table, and the flow
    records no pending or error pointer.
    """
    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    settings = get_settings()
    repository = PostgresServingRepository(settings)
    gap_repository = PostgresGapRepository(settings)

    dates = get_pending_dates(
        repository,
        gap_repository,
        target_date,
        settings.POSTHOG_ABANDON_AFTER_DAYS,
    )
    reopen_candidates = get_reopen_candidates(gap_repository, target_date)
    for current_date in dates:
        delivery = _delivery_for(current_date, settings)
        if delivery.state is SourceState.PENDING:
            _handle_pending_source(current_date, target_date, settings, gap_repository)
            continue
        if delivery.state is SourceState.FAILED:
            raise RuntimeError(delivery.detail or "PostHog delivery failed")
        _process_date(current_date, delivery, settings, repository)

    for gap in reopen_candidates:
        delivery = _delivery_for(gap.date, settings, use_verifier=False)
        if delivery.state is SourceState.FAILED:
            raise RuntimeError(delivery.detail or "PostHog delivery failed")
        if delivery.state is SourceState.PENDING:
            continue
        _reopen_gap(gap, delivery, gap_repository)
        _process_date(gap.date, delivery, settings, repository)
    return target_date


if __name__ == "__main__":
    nightly_etl_flow()
