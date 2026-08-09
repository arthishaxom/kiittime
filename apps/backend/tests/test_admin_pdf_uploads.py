from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser
from backend.db.session import get_db
from backend.main import app

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "Section wise_Timetable_Scheme A_05-07-26.pdf"


@pytest.fixture
def admin_client(db):
    admin_user = AdminUser(username="admin", hashed_password="pwd")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_admin] = lambda: admin_user
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_create_pdf_upload(admin_client):
    with open(FIXTURE_PATH, "rb") as f:
        pdf_bytes = f.read()

    response = admin_client.post(
        "/admin/uploads/pdf",
        data={"year": 2026},
        files={"file": ("timetable.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert "upload_id" in data
    assert data["status"] == "pending"
    assert "diff" in data
