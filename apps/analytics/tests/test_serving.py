"""Tests for the transactional Gold-to-PostgreSQL serving sync."""

import os
from datetime import UTC, date, datetime, timedelta

import pytest
import sqlalchemy as sa

from analytics.config import Settings
from analytics.serving import (
    GoldSnapshot,
    PostgresServingRepository,
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    sync_metadata,
)

TABLES = (gold_daily_usage, gold_endpoint_health, gold_section_trends, sync_metadata)


def _pg_url() -> str | None:
    return (
        os.environ.get("ANALYTICS_WRITER_DATABASE_URL")
        or os.environ.get("ANALYTICS_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://kiittime_app:localdev@localhost:5432/kiittime_dev"
    )


def _settings(url: str) -> Settings:
    return Settings(
        ANALYTICS_WRITER_DATABASE_URL=url,
        ANALYTICS_POOL_SIZE=1,
        R2_BUCKET_NAME="test-bucket",
    )


@pytest.fixture
def repository():
    url = _pg_url()
    assert url
    repo = PostgresServingRepository(_settings(url))
    try:
        with repo.engine.begin() as conn:
            conn.execute(sa.text("SELECT 1"))
    except Exception as exc:
        repo.engine.dispose()
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    for table in TABLES:
        table.metadata.create_all(repo.engine, checkfirst=True)
    with repo.engine.begin() as conn:
        for table in (gold_endpoint_health, gold_section_trends, gold_daily_usage, sync_metadata):
            conn.execute(table.delete())
    yield repo
    with repo.engine.begin() as conn:
        for table in (gold_endpoint_health, gold_section_trends, gold_daily_usage, sync_metadata):
            conn.execute(table.delete())
    repo.engine.dispose()


def _snapshot(day: date, dau: int = 10) -> GoldSnapshot:
    return GoldSnapshot(
        daily_usage=[{"date": day, "dau": dau, "total_api_calls": 100, "timetable_searches": 40}],
        endpoint_health=[
            {
                "date": day,
                "endpoint": "/timetable/",
                "total_calls": 100,
                "p95_latency_ms": 15.0,
                "error_rate": 0.02,
            }
        ],
        section_trends=[
            {"date": day, "section_name": "22CSE1", "section_year": 2, "search_volume": 40}
        ],
    )


def test_backfill_then_incremental_is_idempotent(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=True)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=False)

    with repository.engine.begin() as conn:
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
    assert usage == 1
    assert health == 1
    meta = repository.metadata()
    assert meta is not None and meta.status == "published" and meta.data_as_of == day


def test_reprocessed_date_upserts_without_duplicating(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day, dau=10), expected_date=day, data_as_of=day, replace_all=True)
    repository.publish(_snapshot(day, dau=25), expected_date=day, data_as_of=day, replace_all=False)

    with repository.engine.begin() as conn:
        row = conn.execute(
            sa.select(gold_daily_usage.c.dau).where(gold_daily_usage.c.date == day)
        ).scalar()
        count = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert row == 25
    assert count == 1


def test_incremental_wipe_of_empty_health_is_authoritative(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=True)
    empty_health = GoldSnapshot(
        daily_usage=[{"date": day, "dau": 10, "total_api_calls": 100, "timetable_searches": 40}],
        endpoint_health=[],
        section_trends=[],
    )
    repository.publish(empty_health, expected_date=day, data_as_of=day, replace_all=False)

    with repository.engine.begin() as conn:
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert health == 0
    assert usage == 1


def test_injected_failure_preserves_previous_snapshot(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=True)

    original_upsert = repository._upsert

    def _fail_once(connection, table, rows):
        if table is gold_endpoint_health:
            raise RuntimeError("injected serving failure")
        return original_upsert(connection, table, rows)

    repository._upsert = _fail_once  # type: ignore[method-assign]
    try:
        with pytest.raises(RuntimeError, match="injected serving failure"):
            repository.publish(
                _snapshot(day + timedelta(days=1)),
                expected_date=day + timedelta(days=1),
                data_as_of=day + timedelta(days=1),
                replace_all=False,
            )
    finally:
        repository._upsert = original_upsert  # type: ignore[method-assign]

    with repository.engine.begin() as conn:
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
        row = conn.execute(sa.select(gold_daily_usage.c.date)).scalars().all()
    assert usage == 1
    assert row == [day]
    meta = repository.metadata()
    assert meta is not None and meta.data_as_of == day and meta.status == "published"


def test_confirmed_empty_day_publishes_zero_and_advances(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=True)
    empty_day = day + timedelta(days=1)
    empty = GoldSnapshot(
        daily_usage=[{"date": empty_day, "dau": 0, "total_api_calls": 0, "timetable_searches": 0}],
        endpoint_health=[],
        section_trends=[],
    )
    repository.publish(empty, expected_date=empty_day, data_as_of=empty_day, replace_all=False)

    meta = repository.metadata()
    assert meta is not None and meta.data_as_of == empty_day
    with repository.engine.begin() as conn:
        dau = conn.execute(
            sa.select(gold_daily_usage.c.dau).where(gold_daily_usage.c.date == empty_day)
        ).scalar()
    assert dau == 0


def test_pending_and_failed_preserve_snapshot(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, data_as_of=day, replace_all=True)

    repository.mark_pending(day + timedelta(days=1))
    meta = repository.metadata()
    assert meta is not None and meta.data_as_of == day and meta.status == "pending"

    repository.mark_failed(day + timedelta(days=1), RuntimeError("delivery failed"))
    meta = repository.metadata()
    assert meta is not None and meta.data_as_of == day and meta.status == "failed"
    assert meta.error_message == "delivery failed"

    with repository.engine.begin() as conn:
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert usage == 1
    assert repository.has_successful_snapshot() is False


def test_data_as_of_never_moves_backward_on_old_reprocess(repository):
    new_day = date(2026, 8, 6)
    old_day = date(2026, 8, 4)
    repository.publish(
        _snapshot(new_day), expected_date=new_day, data_as_of=new_day, replace_all=True
    )
    # Simulate flow-level monotonic guard: reprocessing an older date keeps max().
    current = repository.metadata()
    assert current is not None and current.data_as_of == new_day
    data_as_of = max(old_day, current.data_as_of)
    repository.publish(
        _snapshot(old_day, dau=7), expected_date=old_day, data_as_of=data_as_of, replace_all=False
    )

    meta = repository.metadata()
    assert meta is not None and meta.data_as_of == new_day
    with repository.engine.begin() as conn:
        dates = sorted(conn.execute(sa.select(gold_daily_usage.c.date)).scalars().all())
    assert dates == [old_day, new_day]


def test_publish_records_synced_at(repository):
    day = date(2026, 8, 4)
    before = datetime.now(UTC)
    synced_at = repository.publish(
        _snapshot(day), expected_date=day, data_as_of=day, replace_all=True
    )
    assert synced_at.tzinfo is not None
    assert synced_at >= before - timedelta(seconds=60)
