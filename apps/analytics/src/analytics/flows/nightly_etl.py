"""Nightly ETL Prefect flow."""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# Ensure 'src' is on sys.path for remote runners
src_path = str(Path(__file__).resolve().parents[2])
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from prefect import flow  # noqa: E402

from analytics.config import get_duckdb_conn, get_settings  # noqa: E402
from analytics.control import get_pending_dates, mark_stage, stage_succeeded  # noqa: E402
from analytics.tasks.axiom import pull_axiom_logs  # noqa: E402
from analytics.tasks.posthog import check_posthog_files  # noqa: E402
from analytics.tasks.transform import (  # noqa: E402
    transform_bronze_to_silver,
    transform_silver_to_gold,
)

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")


@flow(name="nightly-etl-flow")
def nightly_etl_flow(target_date: date | None = None) -> date:
    """Process the newest date and any incomplete historical dates."""
    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    settings = get_settings()
    control_path = f"s3://{settings.R2_BUCKET_NAME}/_metadata/pipeline_runs.parquet"
    conn = get_duckdb_conn(settings)
    try:
        dates = get_pending_dates(conn, control_path, target_date)
        for current_date in dates:
            axiom_available = stage_succeeded(conn, control_path, current_date, "axiom", "bronze")
            if not axiom_available:
                try:
                    result = pull_axiom_logs(target_date=current_date)
                    if result is None:
                        mark_stage(
                            conn, control_path, current_date, "axiom", "bronze", "success", 0
                        )
                    else:
                        mark_stage(conn, control_path, current_date, "axiom", "bronze", "success")
                        axiom_available = True
                except Exception:
                    mark_stage(conn, control_path, current_date, "axiom", "bronze", "failed")
                    raise
            if axiom_available and not stage_succeeded(
                conn, control_path, current_date, None, "silver"
            ):
                try:
                    transform_bronze_to_silver(target_date=current_date)
                    mark_stage(conn, control_path, current_date, None, "silver", "success")
                except Exception:
                    mark_stage(conn, control_path, current_date, None, "silver", "failed")
                    raise
            elif not axiom_available:
                mark_stage(conn, control_path, current_date, None, "silver", "success")
            if not stage_succeeded(conn, control_path, current_date, "posthog", "bronze"):
                posthog_path = (
                    f"s3://{settings.R2_BUCKET_NAME}/bronze/posthog/"
                    f"{current_date.year:04d}/{current_date.month:02d}/"
                    f"{current_date.day:02d}/*.parquet*"
                )
                if check_posthog_files(target_date=current_date, path=posthog_path):
                    mark_stage(
                        conn, control_path, current_date, "posthog", "bronze", "success"
                    )
            if not stage_succeeded(conn, control_path, current_date, None, "gold"):
                try:
                    transform_silver_to_gold(target_date=current_date)
                    mark_stage(conn, control_path, current_date, None, "gold", "success")
                except Exception:
                    mark_stage(conn, control_path, current_date, None, "gold", "failed")
                    raise
    finally:
        conn.close()
    return target_date


if __name__ == "__main__":
    nightly_etl_flow()
