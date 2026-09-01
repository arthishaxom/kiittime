"""Tests for the analytics compute seam."""

from datetime import UTC, datetime

import pytest

from backend.analytics.reader import (
    DailyUsageRecord,
    DashboardData,
    EndpointHealthRecord,
    LocalAnalyticsReader,
    MotherDuckAnalyticsReader,
    SectionTrendRecord,
    _ConnectionPool,
    _FallbackReader,
    get_analytics_reader,
    reset_reader_cache,
)
from backend.config import Settings


def test_backend_selection_is_configuration_driven():
    reset_reader_cache()
    reader = get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="local"))
    assert hasattr(reader, "dashboard")


def test_unknown_backend_is_rejected():
    reset_reader_cache()
    with pytest.raises(ValueError, match="ANALYTICS_QUERY_BACKEND"):
        get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="unknown"))


def test_local_dashboard_returns_one_consistent_snapshot(monkeypatch, tmp_path):
    reader = LocalAnalyticsReader(Settings(GOLD_BASE_PATH=str(tmp_path)))
    values = {
        "gold_daily_usage": [(datetime(2026, 1, 1).date(), 4, 9, 2)],
        "gold_endpoint_health": [(datetime(2026, 1, 1).date(), "/health", 9, 12.5, 0.0)],
        "gold_section_trends": [(datetime(2026, 1, 1).date(), "22CSE1", 2, 3)],
    }
    monkeypatch.setattr(reader, "_query", lambda name, columns, order, days: values[name])

    result = reader.dashboard(30)

    assert result.usage == [DailyUsageRecord(datetime(2026, 1, 1).date(), 4, 9, 2)]
    assert result.endpoint_health == [EndpointHealthRecord(datetime(2026, 1, 1).date(), "/health", 9, 12.5, 0.0)]
    assert result.section_trends == [SectionTrendRecord(datetime(2026, 1, 1).date(), "22CSE1", 2, 3)]
    assert result.stale is False
    assert result.data_as_of.tzinfo == UTC
    assert result.data_as_of.date() == datetime(2026, 1, 1).date()



def test_motherduck_requires_server_side_token():
    reset_reader_cache()
    with pytest.raises(ValueError, match="MOTHERDUCK_TOKEN"):
        get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="motherduck", MOTHERDUCK_TOKEN=""))


def test_fallback_reader_caches_and_serves_stale():
    mock_data = DashboardData(
        usage=[(datetime(2026, 1, 1).date(), 10, 100, 50)],
        endpoint_health=[],
        section_trends=[],
        data_as_of=datetime.now(UTC),
        stale=False,
    )

    class FlakyReader:
        def __init__(self):
            self.calls = 0

        def dashboard(self, days: int) -> DashboardData:
            self.calls += 1
            if self.calls == 1:
                return mock_data
            raise ConnectionError("MotherDuck timeout")

    flaky = FlakyReader()
    fallback = _FallbackReader(flaky, max_entries=2)

    # 1. First call succeeds
    res1 = fallback.dashboard(30)
    assert res1.stale is False
    assert res1.usage == mock_data.usage

    # 2. Second call fails, falls back to stale
    res2 = fallback.dashboard(30)
    assert res2.stale is True
    assert res2.usage == mock_data.usage

    # 3. Uncached days query fails and raises
    with pytest.raises(ConnectionError, match="MotherDuck timeout"):
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

