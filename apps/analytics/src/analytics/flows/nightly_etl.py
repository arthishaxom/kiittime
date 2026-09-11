"""Nightly Gold pipeline and PostgreSQL serving publication flow."""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# Ensure ``src`` is on sys.path for remote runners.
src_path = str(Path(__file__).resolve().parents[2])
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from prefect import flow  # noqa: E402

from analytics.config import get_duckdb_conn, get_settings  # noqa: E402
from analytics.control import get_pending_dates, mark_stage, stage_succeeded  # noqa: E402
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


def _delivery_state(delivery: PostHogDelivery | bool) -> PostHogDelivery:
    """Keep the flow compatible with simple task doubles used by operators/tests."""
    if isinstance(delivery, PostHogDelivery):
        return delivery
    return PostHogDelivery(SourceState.DATA if delivery else SourceState.PENDING)


@flow(name="nightly-etl-flow")
def nightly_etl_flow(target_date: date | None = None) -> date:
    """Process incomplete dates oldest-first and publish only complete snapshots.

    Returns the last attempted date. On PENDING the return is the pending
    date (not the requested target); callers must check repository status
    to distinguish stale vs published.
    """
    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    settings = get_settings()
    control_path = f"s3://{settings.R2_BUCKET_NAME}/_metadata/pipeline_runs.parquet"
    conn = get_duckdb_conn(settings)
    repository = PostgresServingRepository(settings)
    try:
        dates = get_pending_dates(conn, control_path, target_date)
        for current_date in dates:
            axiom_available = stage_succeeded(conn, control_path, current_date, "axiom", "bronze")
            if not axiom_available:
                try:
                    result = pull_axiom_logs(target_date=current_date, settings=settings)
                    axiom_available = result is not None
                    mark_stage(
                        conn,
                        control_path,
                        current_date,
                        "axiom",
                        "bronze",
                        "success",
                        1 if axiom_available else 0,
                    )
                except Exception as exc:
                    mark_stage(conn, control_path, current_date, "axiom", "bronze", "failed")
                    repository.mark_failed(current_date, exc)
                    raise

            if not stage_succeeded(conn, control_path, current_date, None, "silver"):
                try:
                    if axiom_available:
                        transform_bronze_to_silver(target_date=current_date, settings=settings)
                    mark_stage(conn, control_path, current_date, None, "silver", "success")
                except Exception as exc:
                    mark_stage(conn, control_path, current_date, None, "silver", "failed")
                    repository.mark_failed(current_date, exc)
                    raise

            posthog_path = (
                f"s3://{settings.R2_BUCKET_NAME}/bronze/posthog/"
                f"{current_date.year:04d}/{current_date.month:02d}/"
                f"{current_date.day:02d}/*.parquet*"
            )
            delivery = _delivery_state(
                check_posthog_files(
                    target_date=current_date,
                    path=posthog_path,
                    settings=settings,
                )
            )
            if delivery.state is SourceState.PENDING:
                mark_stage(
                    conn,
                    control_path,
                    current_date,
                    "posthog",
                    "bronze",
                    "pending",
                    delivery.file_count,
                )
                repository.mark_pending(current_date)
                return current_date
            if delivery.state is SourceState.FAILED:
                error = RuntimeError(delivery.detail or "PostHog delivery failed")
                mark_stage(conn, control_path, current_date, "posthog", "bronze", "failed")
                repository.mark_failed(current_date, error)
                raise error

            mark_stage(
                conn,
                control_path,
                current_date,
                "posthog",
                "bronze",
                "success",
                delivery.file_count,
            )

            if not stage_succeeded(conn, control_path, current_date, None, "gold"):
                try:
                    transform_silver_to_gold(
                        target_date=current_date,
                        settings=settings,
                        posthog_bronze_path=posthog_path,
                        posthog_status=delivery.state,
                    )
                    mark_stage(conn, control_path, current_date, None, "gold", "success")
                except Exception as exc:
                    mark_stage(conn, control_path, current_date, None, "gold", "failed")
                    repository.mark_failed(current_date, exc)
                    raise

            if not stage_succeeded(conn, control_path, current_date, None, "serving"):
                try:
                    sync_gold_to_postgres(
                        target_date=current_date,
                        settings=settings,
                        repository=repository,
                    )
                    mark_stage(conn, control_path, current_date, None, "serving", "success")
                except Exception as exc:
                    mark_stage(conn, control_path, current_date, None, "serving", "failed")
                    repository.mark_failed(current_date, exc)
                    raise
    finally:
        conn.close()
    return target_date


if __name__ == "__main__":
    nightly_etl_flow()
