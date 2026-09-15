"""Tests for the PostgreSQL serving-snapshot reader (ADR-0008 derived freshness)."""

import os
from datetime import UTC, date, datetime, timedelta

import pytest
import sqlalchemy as sa

from backend.analytics.reader import (
    IST_TIMEZONE,
    AnalyticsSnapshotUnavailable,
    DashboardData,
    LocalAnalyticsReader,
    PostgresAnalyticsReader,
    _ConnectionPool,
    _FallbackReader,
    get_analytics_reader,
    reset_reader_cache,
    scheduled_target,
)
from backend.analytics.tables import (
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    pipeline_gaps,
)
from backend.config import Settings

# Fixed clock instants; the deployment publishes at 02:00 Asia/Kolkata.
NOON_IST = datetime(2026, 9, 15, 6, 30, tzinfo=UTC)  # 12:00 IST on Sep 15
EARLY_IST = datetime(2026, 9, 14, 19, 30, tzinfo=UTC)  # 01:00 IST on Sep 15
AFTER_PUBLISH_IST = datetime(2026, 9, 14, 21, 30, tzinfo=UTC)  # 03:00 IST on Sep 15


def _pg_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    assert url, "DATABASE_URL must be set (testcontainers fixture provides it)"
    return url


def _engine():
    return sa.create_engine(_pg_url())


def _clear(engine) -> None:
    with engine.begin() as conn:
        for table in (pipeline_gaps, gold_endpoint_health, gold_section_trends, gold_daily_usage):
            conn.execute(table.delete())


def _seed_published(engine, day: date, *, published_at: datetime | None = None) -> datetime:
    published_at = published_at or datetime.now(UTC)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert().values(
                date=day,
                dau=10,
                total_api_calls=100,
                timetable_searches=40,
                published_at=published_at,
            )
        )
        conn.execute(
            gold_endpoint_health.insert().values(
                date=day,
                endpoint="/timetable/",
                total_calls=100,
                p95_latency_ms=15.0,
                error_rate=0.02,
                published_at=published_at,
            )
        )
        conn.execute(
            gold_section_trends.insert().values(
                date=day,
                section_name="22CSE1",
                section_year=2,
                search_volume=40,
                published_at=published_at,
            )
        )
    return published_at


def _seed_gap(engine, day: date, source: str = "posthog") -> None:
    with engine.begin() as conn:
        conn.execute(
            pipeline_gaps.insert().values(
                date=day,
                source=source,
                reason="no export",
                decided_at=datetime.now(UTC),
            )
        )


def _reader(engine) -> PostgresAnalyticsReader:
    reset_reader_cache()
    return PostgresAnalyticsReader(Settings(ANALYTICS_DATABASE_URL=_pg_url()), engine=engine)


def _freeze_clock(monkeypatch, instant: datetime) -> None:
    monkeypatch.setattr("backend.analytics.reader._utcnow", lambda: instant)


def test_postgres_dashboard_returns_consistent_snapshot(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    day = date(2026, 9, 14)
    published_at = datetime(2026, 9, 15, 6, 0, tzinfo=UTC)
    _clear(engine)
    _seed_published(engine, day, published_at=published_at)

    result = _reader(engine).dashboard(30)

    assert len(result.usage) == 1
    assert result.usage[0].dau == 10
    assert len(result.endpoint_health) == 1
    assert len(result.section_trends) == 1
    assert result.stale is False
    assert result.data_as_of.date() == day
    assert result.synced_at == published_at


def test_postgres_no_snapshot_raises(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    _clear(engine)

    with pytest.raises(AnalyticsSnapshotUnavailable):
        _reader(engine).dashboard(30)


def test_postgres_gap_without_gold_still_raises(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    _clear(engine)
    _seed_gap(engine, date(2026, 9, 14))

    with pytest.raises(AnalyticsSnapshotUnavailable):
        _reader(engine).dashboard(30)


def test_postgres_gap_newer_than_gold_advances_data_as_of(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    gold_day = date(2026, 9, 14)
    gap_day = date(2026, 9, 15)
    _clear(engine)
    _seed_published(engine, gold_day)
    _seed_gap(engine, gap_day)

    result = _reader(engine).dashboard(30)

    assert result.data_as_of.date() == gap_day
    assert result.stale is False
    assert len(result.usage) == 1
    assert result.usage[0].date == gold_day


def test_postgres_stale_after_publish_hour(db, monkeypatch):
    _freeze_clock(monkeypatch, AFTER_PUBLISH_IST)
    engine = _engine()
    _clear(engine)
    _seed_published(engine, date(2026, 9, 13))

    result = _reader(engine).dashboard(30)

    assert result.stale is True
    assert len(result.usage) == 1


def test_postgres_not_stale_before_publish_hour(db, monkeypatch):
    _freeze_clock(monkeypatch, EARLY_IST)
    engine = _engine()
    _clear(engine)
    _seed_published(engine, date(2026, 9, 13))

    result = _reader(engine).dashboard(30)

    assert result.stale is False


def test_scheduled_target_tracks_publish_hour():
    assert scheduled_target(datetime(2026, 9, 15, 3, 0, tzinfo=IST_TIMEZONE), 2) == date(
        2026, 9, 14
    )
    assert scheduled_target(datetime(2026, 9, 15, 2, 0, tzinfo=IST_TIMEZONE), 2) == date(
        2026, 9, 14
    )
    assert scheduled_target(datetime(2026, 9, 15, 1, 0, tzinfo=IST_TIMEZONE), 2) == date(
        2026, 9, 13
    )


def test_postgres_days_filter_bounded(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    old, recent = date(2026, 9, 5), date(2026, 9, 13)
    _clear(engine)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert(),
            [
                {
                    "date": old,
                    "dau": 5,
                    "total_api_calls": 50,
                    "timetable_searches": 10,
                    "published_at": datetime.now(UTC),
                },
                {
                    "date": recent,
                    "dau": 20,
                    "total_api_calls": 200,
                    "timetable_searches": 100,
                    "published_at": datetime.now(UTC),
                },
            ],
        )

    result = _reader(engine).dashboard(5)

    assert [r.date for r in result.usage] == [recent]
    assert result.data_as_of.date() == recent


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


def test_published_at_advances_with_newest_publish(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    older, newer = date(2026, 9, 13), date(2026, 9, 14)
    _clear(engine)
    _seed_published(engine, older, published_at=datetime(2026, 9, 14, 6, 0, tzinfo=UTC))
    newer_stamp = datetime(2026, 9, 15, 6, 0, tzinfo=UTC)
    _seed_published(engine, newer, published_at=newer_stamp)

    result = _reader(engine).dashboard(30)

    assert result.synced_at == newer_stamp
    assert result.data_as_of.date() == newer
    assert not result.stale


def test_synced_at_is_newest_published_at_across_serving_tables(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    day = date(2026, 9, 14)
    usage_stamp = datetime(2026, 9, 15, 5, 0, tzinfo=UTC)
    health_stamp = datetime(2026, 9, 15, 6, 0, tzinfo=UTC)
    trends_stamp = datetime(2026, 9, 15, 5, 30, tzinfo=UTC)
    _clear(engine)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert().values(
                date=day,
                dau=10,
                total_api_calls=100,
                timetable_searches=40,
                published_at=usage_stamp,
            )
        )
        conn.execute(
            gold_endpoint_health.insert().values(
                date=day,
                endpoint="/timetable/",
                total_calls=100,
                p95_latency_ms=15.0,
                error_rate=0.02,
                published_at=health_stamp,
            )
        )
        conn.execute(
            gold_section_trends.insert().values(
                date=day,
                section_name="22CSE1",
                section_year=2,
                search_volume=40,
                published_at=trends_stamp,
            )
        )

    result = _reader(engine).dashboard(30)

    assert result.synced_at == health_stamp


def test_postgres_dashboard_when_only_daily_usage_rows_exist(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    day = date(2026, 9, 14)
    stamp = datetime(2026, 9, 15, 6, 0, tzinfo=UTC)
    _clear(engine)
    with engine.begin() as conn:
        conn.execute(
            gold_daily_usage.insert().values(
                date=day,
                dau=0,
                total_api_calls=0,
                timetable_searches=0,
                published_at=stamp,
            )
        )

    result = _reader(engine).dashboard(30)

    assert result.synced_at == stamp
    assert result.endpoint_health == []
    assert result.section_trends == []


def test_gap_older_than_gold_does_not_move_data_as_of(db, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    engine = _engine()
    gold_day = date(2026, 9, 14)
    _clear(engine)
    _seed_published(engine, gold_day)
    _seed_gap(engine, gold_day - timedelta(days=3))

    result = _reader(engine).dashboard(30)

    assert result.data_as_of.date() == gold_day
