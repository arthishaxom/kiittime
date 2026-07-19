import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.api.routers.otp import get_email_provider
from backend.db.models import OTPVerification, RollNumberMapping, Section
from backend.db.session import get_db
from backend.email import EmailProvider
from backend.main import app


class MockEmailProvider(EmailProvider):

    def __init__(self):
        self.sent_emails = []

    def send_email(self, to: str, subject: str, html: str) -> bool:
        self.sent_emails.append({"to": to, "subject": subject, "html": html})
        return True


@pytest.fixture
def mock_email():
    provider = MockEmailProvider()
    app.dependency_overrides[get_email_provider] = lambda: provider
    yield provider
    app.dependency_overrides.clear()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    # Note: app.dependency_overrides.clear() will clear all overrides,
    # so we rely on the specific fixtures to manage their overrides if run in isolation.


def get_or_create_section(db, section_name: str, year: int) -> Section:
    sec = db.execute(
        select(Section).where(Section.section_name == section_name, Section.year == year)
    ).scalar_one_or_none()
    if not sec:
        sec = Section(section_name=section_name, year=year)
        db.add(sec)
        db.commit()
    return sec


def test_send_otp_success(client, db, mock_email):
    # Setup: Create some sections
    section1 = get_or_create_section(db, "CS_SEND_1", 2)
    section2 = get_or_create_section(db, "CS_SEND_2", 2)

    # Send request
    response = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105123", "section_ids": [section1.id, section2.id]},
    )
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "OTP sent successfully"}

    # Verify email was "sent" with correct derivation
    assert len(mock_email.sent_emails) == 1
    email = mock_email.sent_emails[0]
    assert email["to"] == "2105123@kiit.ac.in"
    assert "KIIT Time" in email["subject"]

    # Verify OTP was saved in DB
    otp_record = db.execute(
        select(OTPVerification).where(OTPVerification.roll_no == "2105123")
    ).scalar_one()
    assert otp_record.is_verified is False
    assert len(otp_record.otp_code) == 6
    assert otp_record.section_ids == [section1.id, section2.id]


def test_send_otp_invalid_section(client, db, mock_email):
    response = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105123", "section_ids": [99999]},
    )
    assert response.status_code == 404
    assert "sections do not exist" in response.json()["detail"]
    assert len(mock_email.sent_emails) == 0


def test_verify_otp_success(client, db, mock_email):
    section = get_or_create_section(db, "CS_VERIFY_1", 3)

    # Send OTP first
    send_res = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105124", "section_ids": [section.id]},
    )
    assert send_res.status_code == 200

    # Retrieve code from DB
    otp_record = db.execute(
        select(OTPVerification).where(OTPVerification.roll_no == "2105124")
    ).scalar_one()
    code = otp_record.otp_code

    # Verify
    verify_res = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105124", "otp_code": code},
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["status"] == "ok"
    assert data["academic_year"] == 3
    assert len(data["sections"]) == 1
    assert data["sections"][0]["section_name"] == "CS_VERIFY_1"

    # Check mapping was created in DB
    mapping = db.execute(
        select(RollNumberMapping).where(
            RollNumberMapping.roll_no == "2105124",
            RollNumberMapping.section_id == section.id
        )
    ).scalar_one()
    assert mapping.academic_year == 3


def test_verify_otp_invalid_code(client, db, mock_email):
    section = get_or_create_section(db, "CS_VERIFY_2", 3)

    client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105125", "section_ids": [section.id]},
    )

    verify_res = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105125", "otp_code": "000000"},  # incorrect code
    )
    assert verify_res.status_code == 400
    assert "Invalid or expired OTP" in verify_res.json()["detail"]
