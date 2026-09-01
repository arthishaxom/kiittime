"""Tests for admin analytics router endpoints."""

from datetime import UTC, datetime, timedelta

import duckdb
import pytest
from deltalake import write_deltalake
from fastapi.testclient import TestClient

from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser
from backend.db.session import get_db
from backend.main import app


@pytest.fixture
def unauthenticated_client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(db):
    admin_user = AdminUser(username="admin", hashed_password="pwd")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_analytics_unauthenticated_returns_401(unauthenticated_client):
    r1 = unauthenticated_client.get("/admin/analytics/usage")
    assert r1.status_code == 401

    r2 = unauthenticated_client.get("/admin/analytics/endpoint-health")
    assert r2.status_code == 401

    r3 = unauthenticated_client.get("/admin/analytics/section-trends")
    assert r3.status_code == 401


def test_analytics_cold_start_empty_returns_200_empty_list(admin_client, monkeypatch, tmp_path):
    monkeypatch.setenv("GOLD_BASE_PATH", str(tmp_path / "nonexistent_gold"))

    r1 = admin_client.get("/admin/analytics/usage")
    assert r1.status_code == 200
    assert r1.json() == []

    r2 = admin_client.get("/admin/analytics/endpoint-health")
    assert r2.status_code == 200
    assert r2.json() == []

    r3 = admin_client.get("/admin/analytics/section-trends")
    assert r3.status_code == 200
    assert r3.json() == []


def test_analytics_endpoints_preseeded_data(admin_client, monkeypatch, tmp_path):
    gold_dir = tmp_path / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("GOLD_BASE_PATH", str(gold_dir))

    conn = duckdb.connect()
    today_dt = datetime.now(UTC).date()
    d1 = today_dt - timedelta(days=5)
    d2 = today_dt - timedelta(days=2)
    d3 = today_dt

    # 1. gold_daily_usage table
    usage_data = [
        {"date": d1, "dau": 10, "total_api_calls": 100, "timetable_searches": 40},
        {"date": d2, "dau": 25, "total_api_calls": 250, "timetable_searches": 120},
        {"date": d3, "dau": 40, "total_api_calls": 400, "timetable_searches": 200},
    ]
    usage_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[usage_data])
    write_deltalake(str(gold_dir / "gold_daily_usage"), usage_rel, mode="overwrite")

    # 2. gold_endpoint_health table
    health_data = [
        {
            "date": d1,
            "endpoint": "/timetable/",
            "total_calls": 100,
            "p95_latency_ms": 15.0,
            "error_rate": 0.02,
        },
        {
            "date": d1,
            "endpoint": "/admin/login",
            "total_calls": 5,
            "p95_latency_ms": 50.0,
            "error_rate": 0.0,
        },
        {
            "date": d2,
            "endpoint": "/timetable/",
            "total_calls": 250,
            "p95_latency_ms": 12.0,
            "error_rate": 0.00,
        },
    ]
    health_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[health_data])
    write_deltalake(str(gold_dir / "gold_endpoint_health"), health_rel, mode="overwrite")

    # 3. gold_section_trends table
    trends_data = [
        {"date": d1, "section_name": "22CSE1", "section_year": 2, "search_volume": 40},
        {"date": d1, "section_name": "22CS10", "section_year": 2, "search_volume": 20},
        {"date": d2, "section_name": "22CSE1", "section_year": 2, "search_volume": 60},
    ]
    trends_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[trends_data])
    write_deltalake(str(gold_dir / "gold_section_trends"), trends_rel, mode="overwrite")
    conn.close()

    # GET /admin/analytics/usage
    res1 = admin_client.get("/admin/analytics/usage?days=30")
    assert res1.status_code == 200
    data1 = res1.json()
    assert len(data1) == 3
    assert data1[0] == {
        "date": d1.isoformat(),
        "dau": 10,
        "total_api_calls": 100,
        "timetable_searches": 40,
    }
    assert data1[1]["date"] == d2.isoformat()
    assert data1[2]["date"] == d3.isoformat()

    # GET /admin/analytics/endpoint-health
    res2 = admin_client.get("/admin/analytics/endpoint-health?days=30")
    assert res2.status_code == 200
    data2 = res2.json()
    assert len(data2) == 3
    # Check sorting: date ASC, endpoint ASC (/admin/login before /timetable/ for d1)
    assert data2[0]["endpoint"] == "/admin/login"
    assert data2[0]["date"] == d1.isoformat()
    assert data2[1]["endpoint"] == "/timetable/"
    assert data2[1]["date"] == d1.isoformat()
    assert data2[2]["date"] == d2.isoformat()

    # GET /admin/analytics/section-trends
    res3 = admin_client.get("/admin/analytics/section-trends?days=7")
    assert res3.status_code == 200
    data3 = res3.json()
    assert len(data3) == 3
    # Check sorting: date ASC, section_name ASC (22CS10 before 22CSE1 for d1)
    assert data3[0]["section_name"] == "22CS10"
    assert data3[0]["date"] == d1.isoformat()
    assert data3[1]["section_name"] == "22CSE1"
    assert data3[1]["date"] == d1.isoformat()
    assert data3[2]["date"] == d2.isoformat()


def test_analytics_days_filter(admin_client, monkeypatch, tmp_path):
    gold_dir = tmp_path / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("GOLD_BASE_PATH", str(gold_dir))

    conn = duckdb.connect()
    today_dt = datetime.now(UTC).date()
    old_date = today_dt - timedelta(days=10)
    recent_date = today_dt - timedelta(days=2)

    usage_data = [
        {"date": old_date, "dau": 5, "total_api_calls": 50, "timetable_searches": 10},
        {"date": recent_date, "dau": 20, "total_api_calls": 200, "timetable_searches": 100},
    ]
    usage_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[usage_data])
    write_deltalake(str(gold_dir / "gold_daily_usage"), usage_rel, mode="overwrite")
    conn.close()

    # Query with days=5 should only return recent_date
    res = admin_client.get("/admin/analytics/usage?days=5")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["date"] == recent_date.isoformat()


def test_dashboard_unauthenticated_returns_401(unauthenticated_client):
    res = unauthenticated_client.get("/admin/analytics/dashboard")
    assert res.status_code == 401


def test_dashboard_cold_start_returns_200(admin_client, monkeypatch, tmp_path):
    from backend.analytics.reader import reset_reader_cache
    reset_reader_cache()
    monkeypatch.setenv("GOLD_BASE_PATH", str(tmp_path / "empty_gold"))
    monkeypatch.setenv("ANALYTICS_QUERY_BACKEND", "local")

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert data["usage"] == []
    assert data["endpoint_health"] == []
    assert data["section_trends"] == []
    assert data["stale"] is False
    assert "data_as_of" in data


def test_dashboard_preseeded_data(admin_client, monkeypatch, tmp_path):
    from backend.analytics.reader import reset_reader_cache
    reset_reader_cache()
    gold_dir = tmp_path / "gold"
    gold_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("GOLD_BASE_PATH", str(gold_dir))
    monkeypatch.setenv("ANALYTICS_QUERY_BACKEND", "local")

    conn = duckdb.connect()
    today_dt = datetime.now(UTC).date()
    d1 = today_dt - timedelta(days=5)

    usage_data = [{"date": d1, "dau": 10, "total_api_calls": 100, "timetable_searches": 40}]
    usage_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[usage_data])
    write_deltalake(str(gold_dir / "gold_daily_usage"), usage_rel, mode="overwrite")

    health_data = [{"date": d1, "endpoint": "/timetable/", "total_calls": 100, "p95_latency_ms": 15.0, "error_rate": 0.02}]
    health_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[health_data])
    write_deltalake(str(gold_dir / "gold_endpoint_health"), health_rel, mode="overwrite")

    trends_data = [{"date": d1, "section_name": "22CSE1", "section_year": 2, "search_volume": 40}]
    trends_rel = conn.sql("SELECT t.* FROM (SELECT unnest(?) AS t)", params=[trends_data])
    write_deltalake(str(gold_dir / "gold_section_trends"), trends_rel, mode="overwrite")
    conn.close()

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 200
    data = res.json()
    assert len(data["usage"]) == 1
    assert data["usage"][0]["dau"] == 10
    assert len(data["endpoint_health"]) == 1
    assert data["endpoint_health"][0]["endpoint"] == "/timetable/"
    assert len(data["section_trends"]) == 1
    assert data["section_trends"][0]["section_name"] == "22CSE1"
    assert data["stale"] is False


def test_dashboard_bounds_validation(admin_client):
    r_low = admin_client.get("/admin/analytics/dashboard?days=0")
    assert r_low.status_code == 422

    r_high = admin_client.get("/admin/analytics/dashboard?days=366")
    assert r_high.status_code == 422

    r_valid = admin_client.get("/admin/analytics/dashboard?days=1")
    assert r_valid.status_code in (200, 503)


def test_dashboard_unavailable_returns_503(admin_client, monkeypatch):
    from backend.analytics.reader import reset_reader_cache
    reset_reader_cache()

    class BrokenReader:
        def dashboard(self, days: int):
            raise RuntimeError("Database unreachable")

    monkeypatch.setattr("backend.api.routers.analytics.get_analytics_reader", lambda: BrokenReader())

    res = admin_client.get("/admin/analytics/dashboard?days=30")
    assert res.status_code == 503
    assert res.json()["detail"] == "Analytics temporarily unavailable"

