"""Tests for the retired R2 control object's gap migration and audit path."""

import os
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb
import pytest
import sqlalchemy as sa

from analytics.config import Settings
from analytics.control import (
    MIGRATED_REASON,
    control_object_path,
    migrate_control_gaps,
    read_skip_rows,
    verify_control_gaps,
)
from analytics.gaps import POSTHOG_SOURCE, PostgresGapRepository, pipeline_gaps

CONTROL_SCHEMA = (
    "date DATE, source VARCHAR, stage VARCHAR, status VARCHAR, "
    "processed_at TIMESTAMP, file_count INTEGER, reason VARCHAR"
)
LEGACY_SCHEMA = (
    "date DATE, source VARCHAR, stage VARCHAR, status VARCHAR, "
    "processed_at TIMESTAMP, file_count INTEGER"
)
TABLES = (pipeline_gaps,)


def _write_object(path: Path, rows: list[tuple], schema: str = CONTROL_SCHEMA) -> None:
    conn = duckdb.connect()
    try:
        conn.execute(f"CREATE TABLE control ({schema})")
        placeholders = ", ".join(["?"] * (schema.count(",") + 1))
        conn.executemany(f"INSERT INTO control VALUES ({placeholders})", rows)
        conn.execute(f"COPY control TO '{path}' (FORMAT PARQUET)")
    finally:
        conn.close()


def _pg_url() -> str:
    return (
        os.environ.get("ANALYTICS_WRITER_DATABASE_URL")
        or os.environ.get("ANALYTICS_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://kiittime_app:localdev@localhost:5432/kiittime_dev"
    )


def _settings(url: str) -> Settings:
    return Settings(
        ANALYTICS_WRITER_DATABASE_URL=url,
        ANALYTICS_POOL_SIZE=2,
        R2_BUCKET_NAME="test-bucket",
    )


@pytest.fixture
def repository():
    repo = PostgresGapRepository(_settings(_pg_url()))
    try:
        with repo.engine.begin() as conn:
            conn.execute(sa.text("SELECT 1"))
    except Exception as exc:
        repo.engine.dispose()
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    for table in TABLES:
        table.metadata.create_all(repo.engine, checkfirst=True)
    with repo.engine.begin() as conn:
        for table in TABLES:
            conn.execute(table.delete())
    yield repo
    with repo.engine.begin() as conn:
        for table in TABLES:
            conn.execute(table.delete())
    repo.engine.dispose()


def test_read_skip_rows_selects_only_terminal_gap_rows(tmp_path):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [
            (
                date(2026, 8, 5),
                None,
                "serving",
                "skipped",
                datetime(2026, 8, 12, 3, 0),
                None,
                "auto-abandoned after 7 days pending (no PostHog export)",
            ),
            (date(2026, 8, 6), "posthog", "bronze", "success", datetime(2026, 8, 7, 3, 0), 4, None),
            (date(2026, 8, 7), None, "gold", "success", datetime(2026, 8, 8, 3, 0), None, None),
            (
                date(2026, 8, 8),
                "posthog",
                "bronze",
                "pending",
                datetime(2026, 8, 8, 3, 0),
                None,
                None,
            ),
            (date(2026, 8, 9), None, "serving", "success", datetime(2026, 8, 9, 3, 0), None, None),
            (date(2026, 8, 10), None, "gold", "skipped", datetime(2026, 8, 11, 3, 0), None, "nope"),
        ],
    )

    gaps = read_skip_rows(duckdb.connect(), str(path))

    assert [gap.date for gap in gaps] == [date(2026, 8, 5)]


def test_read_skip_rows_maps_source_reason_and_decision_time(tmp_path):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [
            (
                date(2026, 8, 5),
                None,
                "serving",
                "skipped",
                datetime(2026, 8, 12, 21, 30),
                None,
                "auto-abandoned after 7 days pending (no PostHog export)",
            ),
            (date(2026, 8, 6), "axiom", "serving", "skipped", None, None, "no logs"),
        ],
    )

    gaps = read_skip_rows(duckdb.connect(), str(path))

    assert gaps[0].source == POSTHOG_SOURCE
    assert gaps[0].reason == "auto-abandoned after 7 days pending (no PostHog export)"
    assert gaps[0].decided_at == datetime(2026, 8, 12, 21, 30, tzinfo=UTC)
    assert gaps[1].source == "axiom"
    assert gaps[1].decided_at.tzinfo is UTC


def test_read_skip_rows_fills_missing_reason_on_legacy_object(tmp_path):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [(date(2026, 8, 5), None, "serving", "skipped", datetime(2026, 8, 12, 3, 0), None)],
        schema=LEGACY_SCHEMA,
    )

    gaps = read_skip_rows(duckdb.connect(), str(path))

    assert gaps[0].reason == MIGRATED_REASON


def test_read_skip_rows_stamps_undated_rows_at_read_time(tmp_path):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [(date(2026, 8, 5), None, "serving", "skipped", None, None, "auto-abandoned")],
    )

    before = datetime.now(UTC)
    gaps = read_skip_rows(duckdb.connect(), str(path))
    after = datetime.now(UTC)

    assert before <= gaps[0].decided_at <= after


def test_read_skip_rows_fails_when_object_is_missing(tmp_path):
    path = tmp_path / "does-not-exist.parquet"

    with pytest.raises(FileNotFoundError):
        read_skip_rows(duckdb.connect(), str(path))


def test_control_object_path_points_at_the_retired_object():
    settings = _settings(_pg_url())

    assert (
        control_object_path(settings)
        == "s3://test-bucket/_metadata/pipeline_runs.parquet"
    )


def _skip_row(day: date, reason: str | None = "auto-abandoned") -> tuple:
    return (day, None, "serving", "skipped", datetime(2026, 9, 1, 3, 0), None, reason)


def test_migrate_copies_skip_rows_into_the_ledger(tmp_path, repository):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [
            _skip_row(date(2026, 8, 5), "auto-abandoned after 7 days pending"),
            _skip_row(date(2026, 8, 6), "auto-abandoned after 9 days pending"),
            (date(2026, 8, 7), None, "gold", "success", datetime(2026, 9, 1, 3, 0), None, None),
        ],
    )

    report = migrate_control_gaps(duckdb.connect(), str(path), repository)

    assert report.matches
    assert [gap.date for gap in report.migrated] == [date(2026, 8, 5), date(2026, 8, 6)]
    assert report.already_present == []
    assert [
        (gap.date, gap.source, gap.reason) for gap in repository.all_gaps()
    ] == [
        (date(2026, 8, 5), POSTHOG_SOURCE, "auto-abandoned after 7 days pending"),
        (date(2026, 8, 6), POSTHOG_SOURCE, "auto-abandoned after 9 days pending"),
    ]


def test_migrate_preserves_the_original_decision_time(tmp_path, repository):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [
            (
                date(2026, 8, 5),
                None,
                "serving",
                "skipped",
                datetime(2026, 8, 12, 3, 0),
                None,
                "gone",
            )
        ],
    )

    migrate_control_gaps(duckdb.connect(), str(path), repository)

    gap = repository.gap_for(date(2026, 8, 5))
    assert gap is not None
    assert gap.decided_at == datetime(2026, 8, 12, 3, 0, tzinfo=UTC)


def test_migrate_is_idempotent_and_keeps_existing_decisions(tmp_path, repository):
    first, second = date(2026, 8, 5), date(2026, 8, 6)
    repository.record_gap(
        first, POSTHOG_SOURCE, "operator decision", decided_at=datetime(2026, 9, 1, tzinfo=UTC)
    )
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(path, [_skip_row(first, "object reason"), _skip_row(second, "object reason")])

    report = migrate_control_gaps(duckdb.connect(), str(path), repository)

    assert [gap.date for gap in report.migrated] == [second]
    assert [gap.date for gap in report.already_present] == [first]
    assert len(repository.all_gaps()) == 2
    untouched = repository.gap_for(first)
    assert untouched is not None
    assert untouched.reason == "operator decision"
    assert untouched.decided_at == datetime(2026, 9, 1, tzinfo=UTC)

    rerun = migrate_control_gaps(duckdb.connect(), str(path), repository)

    assert rerun.migrated == []
    assert len(repository.all_gaps()) == 2


def test_migrate_does_not_turn_success_rows_into_gaps(tmp_path, repository):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [
            (date(2026, 8, 5), None, "gold", "success", datetime(2026, 9, 1, 3, 0), None, None),
            (
                date(2026, 8, 5),
                "posthog",
                "bronze",
                "success",
                datetime(2026, 9, 1, 3, 0),
                2,
                None,
            ),
        ],
    )

    report = migrate_control_gaps(duckdb.connect(), str(path), repository)

    assert report.matches
    assert report.object_gaps == []
    assert repository.all_gaps() == []


def test_verify_reports_missing_rows_without_writing(tmp_path, repository):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(
        path,
        [_skip_row(date(2026, 8, 5), "gone"), _skip_row(date(2026, 8, 6), "also gone")],
    )
    repository.record_gap(date(2026, 8, 5), POSTHOG_SOURCE, "gone")

    report = verify_control_gaps(duckdb.connect(), str(path), repository)

    assert report.matches is False
    assert [gap.date for gap in report.missing_from_ledger] == [date(2026, 8, 6)]
    assert len(repository.all_gaps()) == 1


def test_verify_accepts_newer_ledger_rows_and_reason_drift(tmp_path, repository):
    path = tmp_path / "pipeline_runs.parquet"
    _write_object(path, [_skip_row(date(2026, 8, 5), "original wording")])
    repository.record_gap(date(2026, 8, 5), POSTHOG_SOURCE, "reworded by an operator")
    repository.record_gap(date(2026, 8, 6), POSTHOG_SOURCE, "recorded by the flow")

    report = verify_control_gaps(duckdb.connect(), str(path), repository)

    assert report.matches is True
    assert [gap.date for gap in report.reason_drift] == [date(2026, 8, 5)]
    assert [gap.date for gap in report.extra_in_ledger] == [date(2026, 8, 6)]
