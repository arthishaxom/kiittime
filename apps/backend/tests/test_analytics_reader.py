"""Tests for the analytics compute seam."""

from datetime import UTC, datetime

import pytest

from backend.analytics.reader import DashboardData, LocalAnalyticsReader, get_analytics_reader
from backend.config import Settings


def test_backend_selection_is_configuration_driven():
    reader = get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="local"))
    assert isinstance(reader, LocalAnalyticsReader)


def test_unknown_backend_is_rejected():
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

    assert result.usage == values["gold_daily_usage"]
    assert result.endpoint_health == values["gold_endpoint_health"]
    assert result.section_trends == values["gold_section_trends"]
    assert result.stale is False
    assert result.data_as_of.tzinfo == UTC


def test_motherduck_requires_server_side_token():
    with pytest.raises(ValueError, match="MOTHERDUCK_TOKEN"):
        get_analytics_reader(Settings(ANALYTICS_QUERY_BACKEND="motherduck"))
