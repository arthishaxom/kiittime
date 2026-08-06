"""DuckDB transformation tasks for Bronze to Silver pipeline."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import duckdb
from deltalake import write_deltalake
from prefect import task

from analytics.config import Settings, get_duckdb_conn, get_settings

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")


@task(retries=3, retry_delay_seconds=60)
def transform_bronze_to_silver(
    target_date: date | None = None,
    settings: Settings | None = None,
    bronze_path: str | None = None,
    silver_base_path: str | None = None,
    conn: duckdb.DuckDBPyConnection | None = None,
) -> date:
    """Reads Bronze Parquet from R2 and creates silver Delta tables."""
    if settings is None:
        settings = get_settings()

    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    year = f"{target_date.year:04d}"
    month = f"{target_date.month:02d}"
    day = f"{target_date.day:02d}"

    if bronze_path is None:
        bronze_path = (
            f"s3://{settings.R2_BUCKET_NAME}/bronze/backend_logs/"
            f"year={year}/month={month}/day={day}/*.parquet"
        )

    if silver_base_path is None:
        silver_base_path = f"s3://{settings.R2_BUCKET_NAME}/silver"

    silver_api_requests_path = f"{silver_base_path}/silver_api_requests"
    silver_section_requests_path = f"{silver_base_path}/silver_section_requests"

    storage_options = None
    if silver_base_path.startswith("s3://") or silver_base_path.startswith("r2://"):
        if settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY and settings.CF_ACCOUNT_ID:
            storage_options = {
                "AWS_ACCESS_KEY_ID": settings.R2_ACCESS_KEY,
                "AWS_SECRET_ACCESS_KEY": settings.R2_SECRET_KEY,
                "AWS_ENDPOINT_URL": f"https://{settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
                "AWS_REGION": "auto",
                "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
            }

    silver_ingested_at = datetime.now(UTC)

    own_conn = False
    if conn is None:
        conn = get_duckdb_conn(settings)
        own_conn = True

    try:
        clean_bronze_path = bronze_path.replace("\\", "/")
        cols = conn.sql(f"SELECT * FROM read_parquet('{clean_bronze_path}') LIMIT 0").columns

        def get_col_expr(name: str, sql_type: str) -> str:
            if name in cols:
                return f"CAST(src.{name} AS {sql_type}) AS {name}"
            return f"CAST(NULL AS {sql_type}) AS {name}"

        req_id_expr = get_col_expr("request_id", "VARCHAR")
        ts_expr = get_col_expr("timestamp", "TIMESTAMP")
        ingested_expr = get_col_expr("ingested_at", "TIMESTAMP")
        method_expr = get_col_expr("method", "VARCHAR")
        path_expr = get_col_expr("path", "VARCHAR")
        status_expr = get_col_expr("status_code", "INTEGER")
        duration_expr = get_col_expr("duration_ms", "DOUBLE")
        admin_expr = get_col_expr("admin_user", "VARCHAR")
        env_expr = get_col_expr("environment", "VARCHAR")

        date_expr = (
            "CAST(src.timestamp AS DATE) AS date"
            if "timestamp" in cols
            else "CAST(NULL AS DATE) AS date"
        )
        is_error_expr = (
            "(src.status_code >= 400) AS is_error"
            if "status_code" in cols
            else "CAST(FALSE AS BOOLEAN) AS is_error"
        )
        is_timetable_expr = (
            "(src.path = '/timetable/') AS is_timetable"
            if "path" in cols
            else "CAST(FALSE AS BOOLEAN) AS is_timetable"
        )

        api_sql = f"""
            SELECT
                {req_id_expr},
                {ts_expr},
                {ingested_expr},
                {date_expr},
                {method_expr},
                {path_expr},
                {status_expr},
                {duration_expr},
                {admin_expr},
                {env_expr},
                {is_error_expr},
                {is_timetable_expr},
                CAST(? AS TIMESTAMP) AS silver_ingested_at
            FROM read_parquet('{clean_bronze_path}', union_by_name=true) AS src
        """
        api_rel = conn.sql(api_sql, params=[silver_ingested_at])

        target_date_str = target_date.isoformat()

        write_deltalake(
            silver_api_requests_path,
            api_rel,
            mode="overwrite",
            partition_by=["date"],
            predicate=f"date = '{target_date_str}'",
            storage_options=storage_options,
        )

        if "sections" in cols and "request_id" in cols and "timestamp" in cols:
            sec_sql = f"""
                SELECT
                    CAST(sub.request_id AS VARCHAR) AS request_id,
                    CAST(sub.sec.name AS VARCHAR) AS section_name,
                    CAST(sub.sec.year AS INTEGER) AS section_year,
                    CAST(sub.timestamp AS DATE) AS date,
                    CAST(? AS TIMESTAMP) AS silver_ingested_at
                FROM (
                    SELECT src.request_id, src.timestamp, unnest(src.sections) AS sec
                    FROM read_parquet('{clean_bronze_path}', union_by_name=true) AS src
                    WHERE src.sections IS NOT NULL
                ) AS sub
                WHERE sub.sec.name IS NOT NULL
            """
            sec_rel = conn.sql(sec_sql, params=[silver_ingested_at])
        else:
            sec_sql = """
                SELECT
                    CAST(NULL AS VARCHAR) AS request_id,
                    CAST(NULL AS VARCHAR) AS section_name,
                    CAST(NULL AS INTEGER) AS section_year,
                    CAST(NULL AS DATE) AS date,
                    CAST(? AS TIMESTAMP) AS silver_ingested_at
                WHERE 1 = 0
            """
            sec_rel = conn.sql(sec_sql, params=[silver_ingested_at])

        write_deltalake(
            silver_section_requests_path,
            sec_rel,
            mode="overwrite",
            partition_by=["date"],
            predicate=f"date = '{target_date_str}'",
            storage_options=storage_options,
        )

    finally:
        if own_conn:
            conn.close()

    return target_date
