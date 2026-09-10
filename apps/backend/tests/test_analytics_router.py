"""Tests for admin analytics router endpoints (PostgreSQL serving snapshot)."""

import os
from datetime import UTC, date, datetime, timedelta

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from backend.analytics.reader import reset_reader_cache
from backend.analytics.tables import (
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    sync_metadata,
)
from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser
from backend.db.session import get_db
from backend.main import app


def _pg_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    assert url, "DATABASE_URL must be set (testcontainers fixture provides it)"
    return url


def _seed_published(
    day: date | None = None, status: str = "published", expected_date: date | None = None
) -> date:
    day = day or (datetime.now(UTC).date() - timedelta(days=2))
    expected_date = expected_date or day
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            for table in (
                gold_endpoint_health,
                gold_section_trends,
                gold_daily_usage,
                sync_metadata,
            ):
                conn.execute(table.delete())
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
                    expected_date=expected_date,
                    status=status,
                )
            )
    finally:
        engine.dispose()
    reset_reader_cache()
    return day


def _clear_snapshot() -> None:
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            for table in (
                gold_endpoint_health,
                gold_section_trends,
                gold_daily_usage,
                sync_metadata,
            ):
                conn.execute(table.delete())
    finally:
        engine.dispose()
    reset_reader_cache()


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
    assert unauthenticated_client.get("/admin/analytics/usage").status_code == 401
    assert unauthenticated_client.get("/admin/analytics/endpoint-health").status_code == 401
    assert unauthenticated_client.get("/admin/analytics/section-trends").status_code == 401
    assert unauthenticated_client.get("/admin/analytics/dashboard").status_code == 401


def test_analytics_no_snapshot_returns_503(admin_client):
    _clear_snapshot()

    assert admin_client.get("/admin/analytics/dashboard?days=30").status_code == 503
    assert admin_client.get("/admin/analytics/usage?days=30").status_code == 503


def test_dashboard_published_snapshot(admin_client):
    day = _seed_published()

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


def test_legacy_endpoints_read_published_snapshot(admin_client):
    day = _seed_published()

    r1 = admin_client.get("/admin/analytics/usage?days=30")
    assert r1.status_code == 200
    assert r1.json()[0]["date"] == day.isoformat()

    r2 = admin_client.get("/admin/analytics/endpoint-health?days=30")
    assert r2.status_code == 200
    assert r2.json()[0]["endpoint"] == "/timetable/"

    r3 = admin_client.get("/admin/analytics/section-trends?days=7")
    assert r3.status_code == 200
    assert r3.json()[0]["section_name"] == "22CSE1"


def test_dashboard_pending_snapshot_is_stale(admin_client):
    day = datetime.now(UTC).date() - timedelta(days=2)
    _seed_published(day=day, status="pending", expected_date=day + timedelta(days=1))

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["stale"] is True
    assert len(data["usage"]) == 1


def test_dashboard_days_filter(admin_client):
    today = datetime.now(UTC).date()
    old, recent = today - timedelta(days=10), today - timedelta(days=2)
    engine = sa.create_engine(_pg_url())
    try:
        with engine.begin() as conn:
            for table in (
                gold_endpoint_health,
                gold_section_trends,
                gold_daily_usage,
                sync_metadata,
            ):
                conn.execute(table.delete())
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
    finally:
        engine.dispose()
    reset_reader_cache()

    res = admin_client.get("/admin/analytics/usage?days=5")
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["date"] == recent.isoformat()


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
