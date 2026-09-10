"""Durable control metadata for idempotent analytics processing."""

from datetime import UTC, date, datetime

import duckdb

CONTROL_SCHEMA = """
    date DATE, source VARCHAR, stage VARCHAR, status VARCHAR,
    processed_at TIMESTAMP, file_count INTEGER
"""


def _table_exists(conn: duckdb.DuckDBPyConnection, path: str) -> bool:
    try:
        conn.execute(f"SELECT 1 FROM read_parquet('{path}') LIMIT 1")
        return True
    except Exception:
        return False


def _ensure_table(conn: duckdb.DuckDBPyConnection, path: str) -> None:
    if _table_exists(conn, path):
        conn.execute(
            f"CREATE OR REPLACE TEMP TABLE pipeline_runs AS SELECT * FROM read_parquet('{path}')"
        )
    else:
        conn.execute(f"CREATE OR REPLACE TEMP TABLE pipeline_runs ({CONTROL_SCHEMA})")


def get_pending_dates(conn: duckdb.DuckDBPyConnection, path: str, target_date: date) -> list[date]:
    """Return incomplete dates oldest-first, always including the requested date."""
    _ensure_table(conn, path)
    rows = conn.execute(
        """SELECT date FROM pipeline_runs GROUP BY date
           HAVING NOT (COALESCE(BOOL_OR(stage = 'gold' AND status = 'success'), FALSE)
                       AND COALESCE(BOOL_OR(stage = 'serving' AND status = 'success'), FALSE))
           ORDER BY date"""
    ).fetchall()
    dates = {row[0] for row in rows}
    dates.add(target_date)
    return sorted(dates)


def stage_succeeded(
    conn: duckdb.DuckDBPyConnection,
    path: str,
    target_date: date,
    source: str | None,
    stage: str,
) -> bool:
    _ensure_table(conn, path)
    row = conn.execute(
        "SELECT COUNT(*) FROM pipeline_runs "
        "WHERE date = ? AND source IS NOT DISTINCT FROM ? "
        "AND stage = ? AND status = 'success'",
        [target_date, source, stage],
    ).fetchone()
    return bool(row[0]) if row is not None else False


def mark_stage(
    conn: duckdb.DuckDBPyConnection,
    path: str,
    target_date: date,
    source: str | None,
    stage: str,
    status: str,
    file_count: int | None = None,
) -> None:
    """Upsert a stage result and persist the complete control table."""
    _ensure_table(conn, path)
    conn.execute(
        "CREATE OR REPLACE TEMP TABLE pipeline_runs_next AS "
        "SELECT * FROM pipeline_runs WHERE NOT "
        "(date = ? AND source IS NOT DISTINCT FROM ? AND stage = ?)",
        [target_date, source, stage],
    )
    conn.execute(
        "INSERT INTO pipeline_runs_next VALUES (?, ?, ?, ?, ?, ?)",
        [target_date, source, stage, status, datetime.now(UTC), file_count],
    )
    conn.execute(f"COPY pipeline_runs_next TO '{path}' (FORMAT PARQUET, OVERWRITE)")
    conn.execute("CREATE OR REPLACE TEMP TABLE pipeline_runs AS SELECT * FROM pipeline_runs_next")
