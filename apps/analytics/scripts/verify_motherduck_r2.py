"""Safe connectivity and Gold readability checks for MotherDuck/R2.

This never writes to R2 or changes Delta tables. It is suitable for validating
that a rebuild/backfill output remains readable after publication.
"""

from __future__ import annotations

import argparse
import os
from datetime import date, timedelta
from pathlib import Path

import duckdb
from dotenv import load_dotenv

TABLES = {
    "daily_usage": "gold/gold_daily_usage",
    "endpoint_health": "gold/gold_endpoint_health",
    "section_trends": "gold/gold_section_trends",
}
ROOT = Path(__file__).resolve().parents[1]


def path(relative: str) -> str:
    return f"s3://{os.getenv('R2_BUCKET_NAME', 'kiittime-analytics')}/{relative}"


def main() -> None:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    token = os.environ.get("MOTHERDUCK_TOKEN")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN is required")
    account = os.environ.get("CF_ACCOUNT_ID")
    if not account:
        raise RuntimeError("CF_ACCOUNT_ID is required")

    database = os.getenv("MOTHERDUCK_DATABASE", "my_db")
    conn = duckdb.connect(f"md:{database}?motherduck_token={token}")
    try:
        conn.execute("INSTALL httpfs; LOAD httpfs;")
        conn.execute("INSTALL delta; LOAD delta;")
        conn.execute(
            """CREATE OR REPLACE SECRET r2 (TYPE S3, KEY_ID ?, SECRET ?,
            REGION 'auto', ENDPOINT ?);""",
            [os.environ["R2_ACCESS_KEY"], os.environ["R2_SECRET_KEY"],
             f"{account}.r2.cloudflarestorage.com"],
        )
        start = args.date - timedelta(days=1)
        for name, relative in TABLES.items():
            rows = conn.execute(
                "SELECT count(*) FROM delta_scan(?) WHERE date BETWEEN ? AND ?",
                [path(relative), start, args.date],
            ).fetchone()[0]
            print(f"{name}: readable, rows_in_2_day_window={rows}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
