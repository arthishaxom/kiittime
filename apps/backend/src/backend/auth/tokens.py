import os
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv

load_dotenv()

_secret = os.getenv("SECRET_KEY")
if not _secret:
    if os.getenv("CI") == "true" or os.getenv("TESTING") == "true":
        _secret = "ci-testing-secret-key-fallback"
    else:
        raise RuntimeError("SECRET_KEY is not set — check your .env file")
SECRET_KEY: str = _secret


ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours, tunable


def create_access_token(subject: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload["sub"]
