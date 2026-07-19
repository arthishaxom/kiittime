import json
import re
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.api.routers.otp import get_email_provider
from backend.db.models import RollNumberMapping, Section
from backend.db.session import get_db
from backend.email import EmailProvider
from backend.main import app
from backend.redis import get_redis


class MockEmailProvider(EmailProvider):

    def __init__(self):
        self.sent_emails = []

    def send_email(self, to: str, subject: str, html: str) -> bool:
        self.sent_emails.append({"to": to, "subject": subject, "html": html})
        return True


class MockRedis:
    def __init__(self):
        self.store = {}
        self.expirations = {}

    def get(self, key: str):
        return self.store.get(key)

    def set(self, key: str, value: str, ex: int | None = None):
        self.store[key] = str(value)
        if ex is not None:
            self.expirations[key] = ex
        else:
            self.expirations.pop(key, None)

    def delete(self, key: str):
        self.store.pop(key, None)
        self.expirations.pop(key, None)

    def incr(self, key: str):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    def ttl(self, key: str):
        if key not in self.store:
            return -2
        return self.expirations.get(key, -1)

    def expire(self, key: str, ttl: int):
        if key in self.store:
            self.expirations[key] = ttl
            return True
        return False

    def pipeline(self):
        return MockRedisPipeline(self)


class MockRedisPipeline:
    def __init__(self, client):
        self.client = client
        self.calls = []

    def incr(self, key: str):
        self.calls.append(("incr", key))
        return self

    def ttl(self, key: str):
        self.calls.append(("ttl", key))
        return self

    def execute(self):
        results = []
        for cmd, key in self.calls:
            if cmd == "incr":
                results.append(self.client.incr(key))
            elif cmd == "ttl":
                results.append(self.client.ttl(key))
        return results


@pytest.fixture
def mock_email():
    provider = MockEmailProvider()
    app.dependency_overrides[get_email_provider] = lambda: provider
    yield provider
    if get_email_provider in app.dependency_overrides:
        del app.dependency_overrides[get_email_provider]


@pytest.fixture
def mock_redis():
    client = MockRedis()
    app.dependency_overrides[get_redis] = lambda: client
    yield client
    if get_redis in app.dependency_overrides:
        del app.dependency_overrides[get_redis]


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def get_or_create_section(db, section_name: str, year: int) -> Section:
    sec = db.execute(
        select(Section).where(Section.section_name == section_name, Section.year == year)
    ).scalar_one_or_none()
    if not sec:
        sec = Section(section_name=section_name, year=year)
        db.add(sec)
        db.commit()
    return sec


def test_send_otp_success(client, db, mock_email, mock_redis):
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

    # Verify OTP was saved in Redis
    otp_data_raw = mock_redis.get("otp:2105123")
    assert otp_data_raw is not None
    otp_data = json.loads(otp_data_raw)
    assert "otp_hash" in otp_data
    assert otp_data["attempts_left"] == 3
    assert otp_data["section_ids"] == [section1.id, section2.id]


def test_send_otp_invalid_section(client, db, mock_email, mock_redis):
    response = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105123", "section_ids": [99999]},
    )
    assert response.status_code == 404
    assert "sections do not exist" in response.json()["detail"]
    assert len(mock_email.sent_emails) == 0


def test_verify_otp_success(client, db, mock_email, mock_redis):
    section = get_or_create_section(db, "CS_VERIFY_1", 3)

    # Send OTP first
    send_res = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105124", "section_ids": [section.id]},
    )
    assert send_res.status_code == 200

    # Retrieve code from email
    email = mock_email.sent_emails[0]
    match = re.search(r"\b\d{6}\b", email["html"])
    assert match is not None
    code = match.group(0)

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

    # Check OTP was deleted from Redis
    assert mock_redis.get("otp:2105124") is None


def test_verify_otp_invalid_code(client, db, mock_email, mock_redis):
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
    assert "2 attempts remaining" in verify_res.json()["detail"]


def test_resend_cooldown(client, db, mock_email, mock_redis):
    section = get_or_create_section(db, "CS_COOLDOWN_1", 3)

    # First send is successful
    res1 = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105126", "section_ids": [section.id]},
    )
    assert res1.status_code == 200

    # Second immediate send should fail with cooldown
    res2 = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105126", "section_ids": [section.id]},
    )
    assert res2.status_code == 429
    assert "Please wait" in res2.json()["detail"]


def test_hourly_rate_limit(client, db, mock_email, mock_redis):
    section = get_or_create_section(db, "CS_RATELIMIT_1", 3)

    # Send 5 times successfully (we bypass cooldown manually in mock_redis between sends)
    for i in range(5):
        mock_redis.delete("cooldown:2105127")
        res = client.post(
            "/api/auth/otp/send",
            json={"roll_no": "2105127", "section_ids": [section.id]},
        )
        assert res.status_code == 200

    # 6th send should fail
    mock_redis.delete("cooldown:2105127")
    res = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105127", "section_ids": [section.id]},
    )
    assert res.status_code == 429
    assert "Rate limit exceeded" in res.json()["detail"]


def test_attempt_capping_and_lockout(client, db, mock_email, mock_redis):
    section = get_or_create_section(db, "CS_LOCKOUT_1", 3)

    client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105128", "section_ids": [section.id]},
    )

    # Failed attempt 1
    res1 = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105128", "otp_code": "000000"},
    )
    assert res1.status_code == 400
    assert "2 attempts remaining" in res1.json()["detail"]

    # Failed attempt 2
    res2 = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105128", "otp_code": "000000"},
    )
    assert res2.status_code == 400
    assert "1 attempts remaining" in res2.json()["detail"]

    # Failed attempt 3 -> Lockout
    res3 = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105128", "otp_code": "000000"},
    )
    assert res3.status_code == 429
    assert "Too many failed attempts. Account locked." in res3.json()["detail"]

    # Verify we can no longer send or verify
    res_send = client.post(
        "/api/auth/otp/send",
        json={"roll_no": "2105128", "section_ids": [section.id]},
    )
    assert res_send.status_code == 429

    res_verify = client.post(
        "/api/auth/otp/verify",
        json={"roll_no": "2105128", "otp_code": "123456"},
    )
    assert res_verify.status_code == 429
