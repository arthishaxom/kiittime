"""Axiom log extraction Prefect task."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import axiom_py
import pyarrow as pa
from axiom_py import AplOptions
from prefect import task

from analytics.config import Settings, get_duckdb_conn, get_settings

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")

BRONZE_LOGS_SCHEMA = pa.schema(
    [
        ("request_id", pa.string()),
        ("timestamp", pa.string()),
        ("ingested_at", pa.string()),
        ("level", pa.string()),
        ("event", pa.string()),
        ("method", pa.string()),
        ("path", pa.string()),
        ("status_code", pa.int32()),
        ("duration_ms", pa.float64()),
        ("admin_user", pa.string()),
        ("environment", pa.string()),
        ("sections", pa.list_(pa.struct([("name", pa.string()), ("year", pa.int32())]))),
    ]
)


@task(retries=3, retry_delay_seconds=60)
def pull_axiom_logs(
    target_date: date | None = None, settings: Settings | None = None
) -> date | None:
    """Queries Axiom Query API for target_date's backend logs and writes to R2 Bronze Parquet."""
    if settings is None:
        settings = get_settings()

    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    start_time_ist = datetime.combine(target_date, time.min, tzinfo=IST_TIMEZONE)
    end_time_ist = datetime.combine(target_date, time.max, tzinfo=IST_TIMEZONE)

    start_time = start_time_ist.astimezone(UTC).replace(tzinfo=None)
    end_time = end_time_ist.astimezone(UTC).replace(tzinfo=None)

    ingested_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not settings.AXIOM_API_KEY:
        raise ValueError(
            "AXIOM_API_KEY is not configured in settings/environment. Cannot query Axiom logs."
        )

    client = axiom_py.Client(
        settings.AXIOM_API_KEY,
        org_id=settings.AXIOM_ORG_ID or None,
    )
    opts = AplOptions(start_time=start_time, end_time=end_time)
    res = client.apl_query(f"['{settings.AXIOM_DATASET}']", opts=opts)

    rows = []
    if res.matches:
        for match in res.matches:
            if match.data:
                row = dict(match.data)
                if "timestamp" not in row and match._time:
                    row["timestamp"] = match._time
                row["ingested_at"] = ingested_at
                rows.append(row)

    if not rows:
        return None

    base_bronze_path = f"s3://{settings.R2_BUCKET_NAME}/bronze/backend_logs"
    table = pa.Table.from_pylist(rows, schema=BRONZE_LOGS_SCHEMA)

    conn = get_duckdb_conn(settings)
    try:
        conn.register("arrow_bronze", table)
        query_sql = f"""
            COPY (
                SELECT 
                    *,
                    strftime(timestamp::TIMESTAMP, '%Y') AS year,
                    strftime(timestamp::TIMESTAMP, '%m') AS month,
                    strftime(timestamp::TIMESTAMP, '%d') AS day
                FROM arrow_bronze
            ) TO '{base_bronze_path}'
            (FORMAT PARQUET, PARTITION_BY (year, month, day), OVERWRITE)
        """
        conn.execute(query_sql)
    finally:
        conn.close()

    return target_date
