"""Tests for the transactional Gold-to-PostgreSQL serving sync."""

import os
from datetime import UTC, date, datetime, timedelta

import pytest
import sqlalchemy as sa

from analytics.config import Settings
from analytics.serving import (
    GoldSnapshot,
    PostgresServingRepository,
    _writer_database_url,
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    sync_gold_to_postgres,
)

TABLES = (gold_daily_usage, gold_endpoint_health, gold_section_trends)


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
        for table in (gold_endpoint_health, gold_section_trends, gold_daily_usage):
            conn.execute(table.delete())
    yield repo
    with repo.engine.begin() as conn:
        for table in (gold_endpoint_health, gold_section_trends, gold_daily_usage):
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
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    repository.publish(_snapshot(day), expected_date=day, replace_all=False)

    with repository.engine.begin() as conn:
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
    assert usage == 1
    assert health == 1


def test_reprocessed_date_upserts_without_duplicating(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day, dau=10), expected_date=day, replace_all=True)
    repository.publish(_snapshot(day, dau=25), expected_date=day, replace_all=False)

    with repository.engine.begin() as conn:
        row = conn.execute(
            sa.select(gold_daily_usage.c.dau).where(gold_daily_usage.c.date == day)
        ).scalar()
        count = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert row == 25
    assert count == 1


def test_incremental_empty_health_preserves_prior_rows(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    empty_health = GoldSnapshot(
        daily_usage=[{"date": day, "dau": 10, "total_api_calls": 100, "timetable_searches": 40}],
        endpoint_health=[],
        section_trends=[],
    )
    repository.publish(empty_health, expected_date=day, replace_all=False)

    with repository.engine.begin() as conn:
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
        trends = conn.execute(sa.select(sa.func.count()).select_from(gold_section_trends)).scalar()
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert health == 1
    assert trends == 1
    assert usage == 1


def test_authoritative_empty_removes_expected_date_rows(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    empty_health = GoldSnapshot(
        daily_usage=[{"date": day, "dau": 0, "total_api_calls": 0, "timetable_searches": 0}],
        endpoint_health=[],
        section_trends=[],
    )
    repository.publish(
        empty_health, expected_date=day, rebuild=False, authoritative_empty=True
    )

    with repository.engine.begin() as conn:
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert health == 0
    assert usage == 1


def test_injected_failure_preserves_previous_snapshot(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)

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
                replace_all=False,
            )
    finally:
        repository._upsert = original_upsert  # type: ignore[method-assign]

    with repository.engine.begin() as conn:
        usage = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
        row = conn.execute(sa.select(gold_daily_usage.c.date)).scalars().all()
    assert usage == 1
    assert row == [day]


def test_confirmed_empty_day_publishes_zero(repository):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    empty_day = day + timedelta(days=1)
    empty = GoldSnapshot(
        daily_usage=[{"date": empty_day, "dau": 0, "total_api_calls": 0, "timetable_searches": 0}],
        endpoint_health=[],
        section_trends=[],
    )
    repository.publish(empty, expected_date=empty_day, replace_all=False)

    with repository.engine.begin() as conn:
        dau = conn.execute(
            sa.select(gold_daily_usage.c.dau).where(gold_daily_usage.c.date == empty_day)
        ).scalar()
    assert dau == 0


def _stamps_for_date(repository, day: date) -> set[datetime]:
    with repository.engine.begin() as conn:
        return set(
            conn.execute(
                sa.select(
                    gold_daily_usage.c.published_at,
                    gold_endpoint_health.c.published_at,
                    gold_section_trends.c.published_at,
                )
                .select_from(gold_daily_usage)
                .join(gold_endpoint_health, gold_daily_usage.c.date == gold_endpoint_health.c.date)
                .join(gold_section_trends, gold_daily_usage.c.date == gold_section_trends.c.date)
                .where(gold_daily_usage.c.date == day)
            )
            .tuples()
            .all()
        )


def test_publish_stamps_one_timestamp_on_every_written_row(repository):
    first = date(2026, 8, 4)
    second = date(2026, 8, 5)
    before = datetime.now(UTC)
    published_at = repository.publish(_snapshot(first), expected_date=first, replace_all=True)
    repository.publish(_snapshot(second), expected_date=second, replace_all=False)

    assert published_at >= before
    assert len(_stamps_for_date(repository, second)) == 1
    assert _stamps_for_date(repository, second).pop() > _stamps_for_date(repository, first).pop()


def test_old_reprocess_stamps_new_published_at_without_disturbing_newer_rows(repository):
    new_day = date(2026, 8, 6)
    old_day = date(2026, 8, 4)
    repository.publish(_snapshot(new_day), expected_date=new_day, replace_all=True)
    repository.publish(_snapshot(old_day, dau=7), expected_date=old_day, replace_all=False)

    with repository.engine.begin() as conn:
        dates = sorted(conn.execute(sa.select(gold_daily_usage.c.date)).scalars().all())
        old_stamp = conn.execute(
            sa.select(gold_daily_usage.c.published_at).where(gold_daily_usage.c.date == old_day)
        ).scalar()
        new_stamp = conn.execute(
            sa.select(gold_daily_usage.c.published_at).where(gold_daily_usage.c.date == new_day)
        ).scalar()
    assert dates == [old_day, new_day]
    assert old_stamp > new_stamp


def test_sync_gold_to_postgres_rebuilds_from_full_snapshot_when_empty(repository, monkeypatch):
    seen: dict[str, date | None] = {}

    def fake_read(settings, target_date):
        seen["target_date"] = target_date
        return _snapshot(date(2026, 8, 4))

    monkeypatch.setattr("analytics.serving.read_gold_snapshot", fake_read)
    published_at = sync_gold_to_postgres.fn(
        target_date=date(2026, 8, 4),
        settings=repository.settings,
        repository=repository,
    )

    assert seen["target_date"] is None
    assert published_at.tzinfo is not None
    with repository.engine.begin() as conn:
        count = conn.execute(sa.select(sa.func.count()).select_from(gold_daily_usage)).scalar()
    assert count == 1


def test_sync_gold_to_postgres_reads_only_target_date_when_gold_exists(repository, monkeypatch):
    seeded = date(2026, 8, 4)
    repository.publish(_snapshot(seeded), expected_date=seeded)
    seen: dict[str, date | None] = {}

    def fake_read(settings, target_date):
        seen["target_date"] = target_date
        return _snapshot(date(2026, 8, 5))

    monkeypatch.setattr("analytics.serving.read_gold_snapshot", fake_read)
    sync_gold_to_postgres.fn(
        target_date=date(2026, 8, 5),
        settings=repository.settings,
        repository=repository,
    )

    assert seen["target_date"] == date(2026, 8, 5)


def test_sync_gold_to_postgres_wipes_stale_rows_for_authoritative_empty(repository, monkeypatch):
    day = date(2026, 8, 4)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    empty = GoldSnapshot(
        daily_usage=[{"date": day, "dau": 0, "total_api_calls": 0, "timetable_searches": 0}],
        endpoint_health=[],
        section_trends=[],
    )
    monkeypatch.setattr(
        "analytics.serving.read_gold_snapshot", lambda settings, target_date: empty
    )

    sync_gold_to_postgres.fn(
        target_date=day,
        settings=repository.settings,
        repository=repository,
        authoritative_empty=True,
    )

    with repository.engine.begin() as conn:
        health = conn.execute(sa.select(sa.func.count()).select_from(gold_endpoint_health)).scalar()
        trends = conn.execute(sa.select(sa.func.count()).select_from(gold_section_trends)).scalar()
        dau = conn.execute(
            sa.select(gold_daily_usage.c.dau).where(gold_daily_usage.c.date == day)
        ).scalar()
    assert (health, trends, dau) == (0, 0, 0)


def test_served_dates_returns_gold_dates_in_range(repository):
    day = date(2026, 8, 4)
    newer = date(2026, 8, 6)
    repository.publish(_snapshot(day), expected_date=day, replace_all=True)
    repository.publish(_snapshot(newer), expected_date=newer, replace_all=False)

    assert repository.served_dates(date(2026, 8, 4), date(2026, 8, 5)) == {day}
    assert repository.served_dates(date(2026, 8, 4), date(2026, 8, 6)) == {day, newer}
    assert repository.served_dates(date(2026, 8, 7), date(2026, 8, 9)) == set()


def test_oldest_served_date_is_none_without_gold_rows(repository):
    assert repository.oldest_served_date() is None


def test_oldest_served_date_tracks_earliest_gold_row(repository):
    day = date(2026, 8, 4)
    newer = date(2026, 8, 6)
    repository.publish(_snapshot(newer), expected_date=newer, replace_all=True)
    repository.publish(_snapshot(day), expected_date=day, replace_all=False)

    assert repository.oldest_served_date() == day


def test_writer_requires_dedicated_url_in_prod(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(
        ENVIRONMENT="prod",
        ANALYTICS_WRITER_DATABASE_URL="",
        ANALYTICS_DATABASE_URL="postgresql://read",
        DATABASE_URL="postgresql://shared",
    )
    with pytest.raises(ValueError, match="ANALYTICS_WRITER_DATABASE_URL"):
        _writer_database_url(settings)


def test_writer_fallback_dev_only(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(
        ENVIRONMENT="dev",
        ANALYTICS_WRITER_DATABASE_URL="",
        ANALYTICS_DATABASE_URL="postgresql://read",
        DATABASE_URL="",
    )
    assert _writer_database_url(settings) == "postgresql://read"


def test_writer_env_prod_fallback(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("ENV", "prod")
    settings = Settings(
        ENVIRONMENT="",
        ANALYTICS_WRITER_DATABASE_URL="",
        ANALYTICS_DATABASE_URL="postgresql://read",
        DATABASE_URL="postgresql://shared",
    )
    with pytest.raises(ValueError, match="ANALYTICS_WRITER_DATABASE_URL"):
        _writer_database_url(settings)
