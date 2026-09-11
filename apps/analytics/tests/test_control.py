from datetime import date

import duckdb

from analytics.control import get_pending_dates, mark_stage, stage_succeeded


def test_control_table_creates_and_upserts(tmp_path):
    conn = duckdb.connect()
    path = str(tmp_path / "pipeline_runs.parquet")
    target = date(2026, 8, 4)

    assert get_pending_dates(conn, path, target) == [target]
    mark_stage(conn, path, target, "axiom", "bronze", "failed")
    assert not stage_succeeded(conn, path, target, "axiom", "bronze")
    mark_stage(conn, path, target, "axiom", "bronze", "success", 2)
    assert stage_succeeded(conn, path, target, "axiom", "bronze")
    assert conn.execute(f"SELECT COUNT(*) FROM read_parquet('{path}')").fetchone()[0] == 1


def test_pending_dates_are_oldest_and_exclude_complete_dates(tmp_path):
    conn = duckdb.connect()
    path = str(tmp_path / "pipeline_runs.parquet")
    old = date(2026, 8, 1)
    current = date(2026, 8, 4)
    mark_stage(conn, path, old, None, "gold", "success")
    mark_stage(conn, path, old, None, "serving", "success")
    mark_stage(conn, path, current, None, "gold", "failed")

    assert get_pending_dates(conn, path, current) == [current]


def test_gold_without_serving_remains_pending(tmp_path):
    conn = duckdb.connect()
    path = str(tmp_path / "pipeline_runs.parquet")
    old = date(2026, 8, 1)
    current = date(2026, 8, 4)
    mark_stage(conn, path, old, None, "gold", "success")
    mark_stage(conn, path, current, None, "gold", "success")
    mark_stage(conn, path, current, None, "serving", "success")

    assert get_pending_dates(conn, path, current) == [old, current]
