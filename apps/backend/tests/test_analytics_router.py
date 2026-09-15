"""Tests for admin analytics router endpoints (PostgreSQL serving snapshot)."""

import os
from datetime import UTC, date, datetime

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from backend.analytics.reader import reset_reader_cache
from backend.analytics.tables import (
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    pipeline_gaps,
)
from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser
from backend.db.session import get_db
from backend.main import app

NOON_IST = datetime(2026, 9, 15, 6, 30, tzinfo=UTC)  # 12:00 IST on Sep 15
AFTER_PUBLISH_IST = datetime(2026, 9, 14, 21, 30, tzinfo=UTC)  # 03:00 IST on Sep 15


def _pg_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    assert url, "DATABASE_URL must be set (testcontainers fixture provides it)"
    return url


def _seed_published(day: date | None = None) -> date:
    day = day or date(2026, 9, 14)
    published_at = datetime.now(UTC)
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            for table in (
                pipeline_gaps,
                gold_endpoint_health,
                gold_section_trends,
                gold_daily_usage,
            ):
                conn.execute(table.delete())
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
    finally:
        engine.dispose()
    reset_reader_cache()
    return day


def _seed_gap(day: date, source: str = "posthog") -> None:
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            conn.execute(
                pipeline_gaps.insert().values(
                    date=day,
                    source=source,
                    reason="no export",
                    decided_at=datetime.now(UTC),
                )
            )
    finally:
        engine.dispose()
    reset_reader_cache()


def _clear_snapshot() -> None:
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            for table in (
                pipeline_gaps,
                gold_endpoint_health,
                gold_section_trends,
                gold_daily_usage,
            ):
                conn.execute(table.delete())
    finally:
        engine.dispose()
    reset_reader_cache()


def _freeze_clock(monkeypatch, instant: datetime) -> None:
    monkeypatch.setattr("backend.analytics.reader._utcnow", lambda: instant)


@pytest.fixture
def unauthenticated_client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    reset_reader_cache()


@pytest.fixture
def admin_client(db):
    admin_user = AdminUser(username="admin", hashed_password="pwd")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    reset_reader_cache()


def test_analytics_unauthenticated_returns_401(unauthenticated_client):
    assert unauthenticated_client.get("/admin/analytics/dashboard").status_code == 401


def test_removed_partial_endpoints_return_404(admin_client):
    assert admin_client.get("/admin/analytics/usage?days=30").status_code == 404
    assert admin_client.get("/admin/analytics/endpoint-health?days=30").status_code == 404
    assert admin_client.get("/admin/analytics/section-trends?days=7").status_code == 404


def test_analytics_no_snapshot_returns_503(admin_client):
    _clear_snapshot()

    assert admin_client.get("/admin/analytics/dashboard?days=30").status_code == 503


def test_analytics_gap_without_gold_returns_503(admin_client):
    _clear_snapshot()
    _seed_gap(date(2026, 9, 14))

    assert admin_client.get("/admin/analytics/dashboard?days=30").status_code == 503


def test_dashboard_published_snapshot(admin_client, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    day = _seed_published(date(2026, 9, 14))

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert len(data["usage"]) == 1
    assert data["usage"][0]["date"] == day.isoformat()
    assert data["usage"][0]["dau"] == 10
    assert len(data["endpoint_health"]) == 1
    assert len(data["section_trends"]) == 1
    assert data["stale"] is False
    assert "data_as_of" in data
    assert "synced_at" in data


def test_dashboard_stale_when_behind_schedule(admin_client, monkeypatch):
    _freeze_clock(monkeypatch, AFTER_PUBLISH_IST)
    _seed_published(date(2026, 9, 13))

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["stale"] is True
    assert len(data["usage"]) == 1


def test_dashboard_gap_advances_freshness(admin_client, monkeypatch):
    _freeze_clock(monkeypatch, AFTER_PUBLISH_IST)
    _seed_published(date(2026, 9, 13))
    _seed_gap(date(2026, 9, 14))

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["stale"] is False
    assert data["data_as_of"].startswith("2026-09-14")


def test_removed_partial_endpoints_return_404_authenticated(admin_client):
    _seed_published()

    assert admin_client.get("/admin/analytics/usage?days=30").status_code == 404
    assert admin_client.get("/admin/analytics/endpoint-health?days=30").status_code == 404
    assert admin_client.get("/admin/analytics/section-trends?days=7").status_code == 404


def test_removed_partial_endpoints_return_404_unauthenticated(unauthenticated_client):
    assert unauthenticated_client.get("/admin/analytics/usage?days=30").status_code == 404
    assert unauthenticated_client.get("/admin/analytics/endpoint-health?days=30").status_code == 404
    assert unauthenticated_client.get("/admin/analytics/section-trends?days=7").status_code == 404


def test_dashboard_days_filter(admin_client, monkeypatch):
    _freeze_clock(monkeypatch, NOON_IST)
    old, recent = date(2026, 9, 5), date(2026, 9, 13)
    _seed_published(recent)
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            conn.execute(
                gold_daily_usage.insert().values(
                    date=old,
                    dau=5,
                    total_api_calls=50,
                    timetable_searches=10,
                    published_at=datetime.now(UTC),
                )
            )
    finally:
        engine.dispose()
    reset_reader_cache()

    res = admin_client.get("/admin/analytics/dashboard?days=5")
    assert res.status_code == 200
    assert len(res.json()["usage"]) == 1
    assert res.json()["usage"][0]["date"] == recent.isoformat()


def test_dashboard_bounds_validation(admin_client):
    assert admin_client.get("/admin/analytics/dashboard?days=0").status_code == 422
    assert admin_client.get("/admin/analytics/dashboard?days=366").status_code == 422


def test_dashboard_unavailable_returns_503(admin_client, monkeypatch):
    class BrokenReader:
        def dashboard(self, days: int):
            raise RuntimeError("Database unreachable")

    monkeypatch.setattr(
        "backend.api.routers.analytics.get_analytics_reader", lambda: BrokenReader()
    )

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 503
    assert res.json()["detail"] == "Analytics temporarily unavailable"
