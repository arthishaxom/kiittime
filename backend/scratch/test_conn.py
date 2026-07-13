"""Scratch: verify Aiven Postgres is reachable before touching Alembic."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

database_url = os.environ["DATABASE_URL"]

engine = create_engine(database_url)

with engine.connect() as conn:
    result = conn.execute(text("SELECT version();"))
    print(result.scalar())