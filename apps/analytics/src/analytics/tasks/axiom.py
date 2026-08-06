"""Axiom log extraction Prefect task."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import axiom_py
from axiom_py import AplOptions
from prefect import task

from analytics.config import Settings, get_duckdb_conn, get_settings

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")

EMPTY_LOG_SCHEMA_SAMPLE = [
    {
        "timestamp": "",
        "level": "",
        "event": "",
        "method": "",
        "path": "",
        "status_code": 0,
        "duration_ms": 0.0,
        "admin_user": None,
        "request_id": "",
        "environment": "",
        "sections": [],
        "ingested_at": "",
    }
]


@task(retries=3, retry_delay_seconds=60)
def pull_axiom_logs(target_date: date | None = None, settings: Settings | None = None) -> date:
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

    client = axiom_py.Client(settings.AXIOM_API_KEY)
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

    base_bronze_path = f"s3://{settings.R2_BUCKET_NAME}/bronze/backend_logs"

    sample_ts = f"{target_date.isoformat()}T00:00:00Z"
    if rows:
        payload = rows
    else:
        fallback_row = {
            **EMPTY_LOG_SCHEMA_SAMPLE[0],
            "timestamp": sample_ts,
            "ingested_at": ingested_at,
        }
        payload = [fallback_row]
    where_clause = "WHERE 1=0" if not rows else ""

    conn = get_duckdb_conn(settings)
    try:
        query_sql = f"""
            COPY (
                SELECT 
                    *,
                    strftime(timestamp::TIMESTAMP, '%Y') AS year,
                    strftime(timestamp::TIMESTAMP, '%m') AS month,
                    strftime(timestamp::TIMESTAMP, '%d') AS day
                FROM (SELECT t.* FROM (SELECT unnest(?) AS t))
                {where_clause}
            ) TO '{base_bronze_path}'
            (FORMAT PARQUET, PARTITION_BY (year, month, day), OVERWRITE_OR_IGNORE)
        """
        conn.execute(query_sql, [payload])
    finally:
        conn.close()

    return target_date

