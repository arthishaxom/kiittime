"""Analytics router for admin dashboard."""

from datetime import UTC, datetime, timedelta

from deltalake import DeltaTable
from fastapi import APIRouter, Depends, Query

from backend.api.schemas import DailyUsageItem, EndpointHealthItem, SectionTrendItem
from backend.auth.dependencies import get_current_admin
from backend.config import get_duckdb_conn, get_settings

router = APIRouter(
    prefix="/admin/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_admin)],
)


import logging

logger = logging.getLogger(__name__)


def _get_gold_table_arrow(table_name: str):
    """Loads a Gold Delta table from R2 or local storage into a PyArrow table."""
    settings = get_settings()
    base_path = settings.GOLD_BASE_PATH or f"s3://{settings.R2_BUCKET_NAME}/gold"
    table_path = f"{base_path}/{table_name}"

    storage_options = None
    if base_path.startswith("s3://") or base_path.startswith("r2://"):
        if settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY and settings.CF_ACCOUNT_ID:
            storage_options = {
                "AWS_ACCESS_KEY_ID": settings.R2_ACCESS_KEY,
                "AWS_SECRET_ACCESS_KEY": settings.R2_SECRET_KEY,
                "AWS_ENDPOINT_URL": f"https://{settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
                "AWS_REGION": "auto",
                "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
            }

    try:
        dt = DeltaTable(table_path, storage_options=storage_options)
        return dt.to_pyarrow_table()
    except Exception as e:
        logger.warning(f"Failed to load Gold table '{table_name}' from {table_path}: {e}")
        return None


@router.get("/usage", response_model=list[DailyUsageItem])
def get_daily_usage(
    days: int = Query(30, ge=1, le=365),
) -> list[DailyUsageItem]:
    """Returns daily usage metrics for the last N days sorted by date ascending."""
    arrow_table = _get_gold_table_arrow("gold_daily_usage")
    if arrow_table is None or arrow_table.num_rows == 0:
        return []

    cutoff_date = (datetime.now(UTC) - timedelta(days=days)).date()

    conn = get_duckdb_conn()
    try:
        conn.register("gold_daily_usage", arrow_table)
        res = conn.sql(
            """
            SELECT
                CAST(date AS DATE) AS date,
                CAST(dau AS INTEGER) AS dau,
                CAST(total_api_calls AS INTEGER) AS total_api_calls,
                CAST(timetable_searches AS INTEGER) AS timetable_searches
            FROM gold_daily_usage
            WHERE date >= ?
            ORDER BY date ASC
            """,
            params=[cutoff_date],
        ).fetchall()

        return [
            DailyUsageItem(
                date=row[0],
                dau=row[1],
                total_api_calls=row[2],
                timetable_searches=row[3],
            )
            for row in res
        ]
    finally:
        conn.close()


@router.get("/endpoint-health", response_model=list[EndpointHealthItem])
def get_endpoint_health(
    days: int = Query(30, ge=1, le=365),
) -> list[EndpointHealthItem]:
    """Returns endpoint health metrics for the last N days sorted by date, endpoint ascending."""
    arrow_table = _get_gold_table_arrow("gold_endpoint_health")
    if arrow_table is None or arrow_table.num_rows == 0:
        return []

    cutoff_date = (datetime.now(UTC) - timedelta(days=days)).date()

    conn = get_duckdb_conn()
    try:
        conn.register("gold_endpoint_health", arrow_table)
        res = conn.sql(
            """
            SELECT
                CAST(date AS DATE) AS date,
                CAST(endpoint AS VARCHAR) AS endpoint,
                CAST(total_calls AS INTEGER) AS total_calls,
                CAST(p95_latency_ms AS DOUBLE) AS p95_latency_ms,
                CAST(error_rate AS DOUBLE) AS error_rate
            FROM gold_endpoint_health
            WHERE date >= ?
            ORDER BY date ASC, endpoint ASC
            """,
            params=[cutoff_date],
        ).fetchall()

        return [
            EndpointHealthItem(
                date=row[0],
                endpoint=row[1],
                total_calls=row[2],
                p95_latency_ms=row[3],
                error_rate=row[4],
            )
            for row in res
        ]
    finally:
        conn.close()


@router.get("/section-trends", response_model=list[SectionTrendItem])
def get_section_trends(
    days: int = Query(7, ge=1, le=365),
) -> list[SectionTrendItem]:
    """Returns section trend metrics for the last N days sorted by date, section_name ascending."""
    arrow_table = _get_gold_table_arrow("gold_section_trends")
    if arrow_table is None or arrow_table.num_rows == 0:
        return []

    cutoff_date = (datetime.now(UTC) - timedelta(days=days)).date()

    conn = get_duckdb_conn()
    try:
        conn.register("gold_section_trends", arrow_table)
        res = conn.sql(
            """
            SELECT
                CAST(date AS DATE) AS date,
                CAST(section_name AS VARCHAR) AS section_name,
                CAST(section_year AS INTEGER) AS section_year,
                CAST(search_volume AS INTEGER) AS search_volume
            FROM gold_section_trends
            WHERE date >= ?
            ORDER BY date ASC, section_name ASC
            """,
            params=[cutoff_date],
        ).fetchall()

        return [
            SectionTrendItem(
                date=row[0],
                section_name=row[1],
                section_year=row[2],
                search_volume=row[3],
            )
            for row in res
        ]
    finally:
        conn.close()
