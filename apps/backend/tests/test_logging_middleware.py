import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from structlog.testing import capture_logs

from backend.auth.tokens import create_access_token
from backend.logging import setup_logging
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_unauthenticated_request_emits_structlog_event(client):
    with capture_logs() as captured:
        response = client.get("/health")

    assert response.status_code == 200
    http_events = [e for e in captured if e.get("event") == "http_request"]
    assert len(http_events) == 1

    event = http_events[0]
    assert event["method"] == "GET"
    assert event["path"] == "/health"
    assert event["status_code"] == 200
    assert isinstance(event["duration_ms"], float)
    assert event["duration_ms"] >= 0
    assert "request_id" in event
    assert isinstance(event["request_id"], str)
    assert event["environment"] == os.getenv("ENVIRONMENT", os.getenv("ENV", "dev"))
    assert event["admin_user"] is None
    assert event["sections"] is None


def test_admin_authenticated_request_emits_admin_user(client):
    token = create_access_token("admin@kiit.ac.in")
    headers = {"Authorization": f"Bearer {token}"}

    with capture_logs() as captured:
        response = client.get("/health", headers=headers)

    assert response.status_code == 200
    http_events = [e for e in captured if e.get("event") == "http_request"]
    assert len(http_events) == 1

    event = http_events[0]
    assert event["admin_user"] == "admin@kiit.ac.in"


def test_4xx_response_emits_warning_level(client):
    with capture_logs() as captured:
        response = client.get("/nonexistent-endpoint-12345")

    assert response.status_code == 404
    http_events = [e for e in captured if e.get("event") == "http_request"]
    assert len(http_events) == 1

    event = http_events[0]
    assert event["status_code"] == 404
    assert event.get("log_level") == "warning" or event.get("level") == "warning"


def test_axiom_gated_on_env_var():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("AXIOM_API_KEY", None)
        with patch("axiom_py.Client") as mock_client:
            setup_logging()
            mock_client.assert_not_called()

    with patch.dict(os.environ, {"AXIOM_API_KEY": "dummy-axiom-key"}, clear=False):
        with patch("axiom_py.Client") as mock_client:
            setup_logging()
            mock_client.assert_called_once_with("dummy-axiom-key")


@pytest.fixture
def client_with_db(db):
    from backend.db.session import get_db

    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_timetable_request_emits_sections_field(client_with_db, db):
    from backend.db.models import Section

    s1 = Section(section_name="CS-A", year=3)
    s2 = Section(section_name="CS-B", year=3)
    db.add_all([s1, s2])
    db.flush()

    with capture_logs() as captured:
        response = client_with_db.get(f"/timetable/?section_id={s1.id}&section_id={s2.id}")

    assert response.status_code == 200
    http_events = [e for e in captured if e.get("event") == "http_request"]
    assert len(http_events) == 1

    event = http_events[0]
    assert event["sections"] is not None
    assert len(event["sections"]) == 2
    assert {"name": "CS-A", "year": 3} in event["sections"]
    assert {"name": "CS-B", "year": 3} in event["sections"]
