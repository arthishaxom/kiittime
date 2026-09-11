"""Tests for the PostgreSQL serving-snapshot reader (ADR-0007)."""

import os
from datetime import UTC, date, datetime, timedelta

import pytest
import sqlalchemy as sa

from backend.analytics.reader import (
    AnalyticsSnapshotUnavailable,
    DashboardData,
    LocalAnalyticsReader,
    PostgresAnalyticsReader,
    _ConnectionPool,
    _FallbackReader,
    get_analytics_reader,
    reset_reader_cache,
)
from backend.analytics.tables import (
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    sync_metadata,
)
from backend.config import Settings


def _pg_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    assert url, "DATABASE_URL must be set (testcontainers fixture provides it)"
    return url


def _engine():
    return sa.create_engine(_pg_url())


def _clear(engine) -> None:
    with engine.begin() as conn:
        for table in (gold_endpoint_health, gold_section_trends, gold_daily_usage, sync_metadata):
            conn.execute(table.delete())


def _seed_published(engine, day: date, *, status: str = "published") -> None:
    _clear(engine)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert().values(
                date=day, dau=10, total_api_calls=100, timetable_searches=40
            )
        )
        conn.execute(
            gold_endpoint_health.insert().values(
                date=day,
                endpoint="/timetable/",
                total_calls=100,
                p95_latency_ms=15.0,
                error_rate=0.02,
            )
        )
        conn.execute(
            gold_section_trends.insert().values(
                date=day, section_name="22CSE1", section_year=2, search_volume=40
            )
        )
        conn.execute(
            sync_metadata.insert().values(
                id=1,
                data_as_of=day,
                synced_at=datetime.now(UTC),
                expected_date=day,
                status=status,
                error_message=None,
            )
        )


def _reader(engine) -> PostgresAnalyticsReader:
    reset_reader_cache()
    return PostgresAnalyticsReader(Settings(ANALYTICS_DATABASE_URL=_pg_url()), engine=engine)


def test_postgres_dashboard_returns_consistent_snapshot(db):
    engine = _engine()
    day = datetime.now(UTC).date() - timedelta(days=2)
    _seed_published(engine, day)

    result = _reader(engine).dashboard(30)

    assert len(result.usage) == 1
    assert result.usage[0].dau == 10
    assert len(result.endpoint_health) == 1
    assert len(result.section_trends) == 1
    assert result.stale is False
    assert result.data_as_of.date() == day
    assert result.synced_at.tzinfo is not None


def test_postgres_no_snapshot_raises(db):
    engine = _engine()
    _clear(engine)

    with pytest.raises(AnalyticsSnapshotUnavailable):
        _reader(engine).dashboard(30)


def test_postgres_pending_keeps_prior_snapshot_stale(db):
    engine = _engine()
    day = datetime.now(UTC).date() - timedelta(days=2)
    _seed_published(engine, day)
    expected = day + timedelta(days=1)
    with engine.begin() as conn:
        conn.execute(
            sync_metadata.update()
            .where(sync_metadata.c.id == 1)
            .values(status="pending", expected_date=expected)
        )

    result = _reader(engine).dashboard(30)

    assert len(result.usage) == 1
    assert result.stale is True


def test_postgres_failed_keeps_prior_snapshot_stale(db):
    engine = _engine()
    day = datetime.now(UTC).date() - timedelta(days=2)
    _seed_published(engine, day)
    expected = day + timedelta(days=1)
    with engine.begin() as conn:
        conn.execute(
            sync_metadata.update()
            .where(sync_metadata.c.id == 1)
            .values(status="failed", expected_date=expected, error_message="boom")
        )

    result = _reader(engine).dashboard(30)

    assert len(result.usage) == 1
    assert result.stale is True


def test_postgres_days_filter_bounded(db):
    engine = _engine()
    today = datetime.now(UTC).date()
    old, recent = today - timedelta(days=10), today - timedelta(days=2)
    _clear(engine)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert(),
            [
                {"date": old, "dau": 5, "total_api_calls": 50, "timetable_searches": 10},
                {"date": recent, "dau": 20, "total_api_calls": 200, "timetable_searches": 100},
            ],
        )
        conn.execute(
            sync_metadata.insert().values(
                id=1,
                data_as_of=recent,
                synced_at=datetime.now(UTC),
                expected_date=recent,
                status="published",
            )
        )

    result = _reader(engine).dashboard(5)

    assert [r.date for r in result.usage] == [recent]


def test_backend_selection_is_configuration_driven():
    reset_reader_cache()
    reader = get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="local_r2"))
    assert hasattr(reader, "dashboard")
    reset_reader_cache()
    with pytest.raises(ValueError, match="ANALYTICS_QUERY_BACKEND"):
        get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="unknown"))


def test_default_backend_is_postgres_reader():
    reset_reader_cache()
    reader = get_analytics_reader(
        Settings(ANALYTICS_QUERY_BACKEND="postgres", ANALYTICS_DATABASE_URL=_pg_url())
    )
    assert isinstance(reader, PostgresAnalyticsReader)


def test_fallback_reader_caches_and_serves_stale():
    mock_data = DashboardData(
        usage=[],
        endpoint_health=[],
        section_trends=[],
        data_as_of=datetime.now(UTC),
        synced_at=datetime.now(UTC),
        stale=False,
    )

    class FlakyReader:
        def __init__(self):
            self.calls = 0

        def dashboard(self, days: int) -> DashboardData:
            self.calls += 1
            if self.calls == 1:
                return mock_data
            raise ConnectionError("rollback store timeout")

    flaky = FlakyReader()
    fallback = _FallbackReader(flaky, max_entries=2)

    res1 = fallback.dashboard(30)
    assert res1.stale is False

    res2 = fallback.dashboard(30)
    assert res2.stale is True
    assert res2.usage == mock_data.usage

    with pytest.raises(ConnectionError, match="rollback store timeout"):
        fallback.dashboard(7)


def test_connection_pool_acquire_and_release():
    conns = []

    def factory():
        conn = f"conn_{len(conns) + 1}"
        conns.append(conn)
        return conn

    pool = _ConnectionPool(factory, size=2)
    c1 = pool.acquire()
    assert c1 == "conn_1"
    pool.release(c1)

    c1_reacquired = pool.acquire()
    assert c1_reacquired == "conn_1"
    pool.release(c1_reacquired)


def test_local_rollback_dashboard_returns_consistent_snapshot(monkeypatch, tmp_path):
    reader = LocalAnalyticsReader(Settings(GOLD_BASE_PATH=str(tmp_path)))
    values = {
        "gold_daily_usage": [(date(2026, 1, 1), 4, 9, 2)],
        "gold_endpoint_health": [(date(2026, 1, 1), "/health", 9, 12.5, 0.0)],
        "gold_section_trends": [(date(2026, 1, 1), "22CSE1", 2, 3)],
    }
    monkeypatch.setattr(reader, "_query", lambda name, columns, order, days: values[name])

    result = reader.dashboard(30)

    assert result.usage[0].dau == 4
    assert result.stale is False
    assert result.data_as_of.date() == date(2026, 1, 1)


def test_postgres_old_date_pending_stays_stale(db):
    engine = _engine()
    day = datetime.now(UTC).date() - timedelta(days=2)
    _seed_published(engine, day)
    old_expected = day - timedelta(days=5)
    with engine.begin() as conn:
        conn.execute(
            sync_metadata.update()
            .where(sync_metadata.c.id == 1)
            .values(status="pending", expected_date=old_expected)
        )

    result = _reader(engine).dashboard(30)

    assert len(result.usage) == 1
    assert result.stale is True


def test_reader_requires_dedicated_url_in_prod(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://shared")
    settings = Settings(ENVIRONMENT="prod", ANALYTICS_DATABASE_URL="")
    with pytest.raises(ValueError, match="ANALYTICS_DATABASE_URL"):
        PostgresAnalyticsReader(settings)


def test_reader_fallback_dev_only(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://shared")
    reset_reader_cache()
    reader = PostgresAnalyticsReader(
        Settings(ENVIRONMENT="dev", ANALYTICS_DATABASE_URL="")
    )
    assert reader.engine is not None
    reader.engine.dispose()
    reset_reader_cache()
