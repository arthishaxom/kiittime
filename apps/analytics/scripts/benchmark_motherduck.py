"""Benchmark MotherDuck reads over the R2 Gold Delta tables.

Credentials are read from the environment and never included in output.
Run with: uv run python scripts/benchmark_motherduck.py --output benchmark.json
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

import duckdb

TABLES = {
    "daily_usage": "gold/gold_daily_usage",
    "endpoint_health": "gold/gold_endpoint_health",
    "section_trends": "gold/gold_section_trends",
}
RANGES = (7, 30, 90, 365)


def connect() -> duckdb.DuckDBPyConnection:
    token = os.environ.get("MOTHERDUCK_TOKEN")
    database = os.environ.get("MOTHERDUCK_DATABASE", "my_db")
    if not token:
        raise RuntimeError("MOTHERDUCK_TOKEN is required")
    conn = duckdb.connect(f"md:{database}?motherduck_token={token}")
    conn.execute("INSTALL httpfs; LOAD httpfs;")
    conn.execute("INSTALL delta; LOAD delta;")
    conn.execute(
        """CREATE OR REPLACE SECRET r2 (TYPE S3, KEY_ID ?, SECRET ?,
        REGION 'auto', ENDPOINT ?);""",
        [os.environ["R2_ACCESS_KEY"], os.environ["R2_SECRET_KEY"], r2_endpoint()],
    )
    return conn


def r2_endpoint() -> str:
    account = os.environ.get("CF_ACCOUNT_ID")
    if not account:
        raise RuntimeError("CF_ACCOUNT_ID is required")
    return f"{account}.r2.cloudflarestorage.com"


def table_path(relative: str) -> str:
    bucket = os.environ.get("R2_BUCKET_NAME", "kiittime-analytics")
    return f"s3://{bucket}/{relative}"


def query(conn: duckdb.DuckDBPyConnection, days: int) -> dict[str, object]:
    end = date.today()
    start = end - timedelta(days=days - 1)
    result: dict[str, object] = {"days": days, "start": str(start), "end": str(end)}
    for name, relative in TABLES.items():
        sql = """SELECT * FROM delta_scan(?) WHERE date BETWEEN ? AND ?"""
        started = time.perf_counter()
        rows = conn.execute(sql, [table_path(relative), start, end]).fetchall()
        elapsed = (time.perf_counter() - started) * 1000
        result[name] = {"rows": len(rows), "latency_ms": round(elapsed, 2)}
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("motherduck-benchmark.json"))
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    if args.concurrency < 1:
        parser.error("--concurrency must be positive")

    conn = connect()
    try:
        plans = {}
        for name, relative in TABLES.items():
            plans[name] = conn.execute(
                (
                    "EXPLAIN SELECT * FROM delta_scan(?) "
                    "WHERE date >= current_date - INTERVAL '7 days'"
                ),
                [table_path(relative)],
            ).fetchall()
        ranges = [query(conn, days) for days in RANGES]
    finally:
        conn.close()

    def worker(_: int) -> dict[str, object]:
        local = connect()
        try:
            return query(local, 30)
        finally:
            local.close()

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        concurrent = list(pool.map(worker, range(args.concurrency)))
    total_ms = (time.perf_counter() - started) * 1000
    latencies = [float(item["daily_usage"]["latency_ms"]) for item in concurrent]
    report = {
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ranges": ranges,
        "concurrency": {"users": args.concurrency, "wall_ms": round(total_ms, 2),
                         "daily_usage_p50_ms": statistics.median(latencies)},
        "plans": plans,
        "credentials": "environment-only",
    }
    args.output.write_text(json.dumps(report, indent=2, default=str) + "\n")
    print(f"Wrote benchmark report: {args.output}")


if __name__ == "__main__":
    main()
