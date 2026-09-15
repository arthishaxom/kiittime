"""PostHog batch-export completeness checks.

An absent export is pending, never an empty export. A zero-row export (or a
PostHog interval query that authoritatively returns zero) is the only path to
publishing DAU=0.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from enum import StrEnum
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import boto3
import duckdb
from prefect import task

from analytics.config import Settings, get_settings

logger = logging.getLogger(__name__)
IST_TIMEZONE = ZoneInfo("Asia/Kolkata")


class SourceState(StrEnum):
    DATA = "data"
    EMPTY = "empty"
    PENDING = "pending"
    FAILED = "failed"


@dataclass(frozen=True)
class PostHogDelivery:
    state: SourceState
    file_count: int = 0
    row_count: int | None = None
    detail: str | None = None

    def __bool__(self) -> bool:
        return self.state in {SourceState.DATA, SourceState.EMPTY}


def _date_range(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min, tzinfo=IST_TIMEZONE).astimezone(UTC)
    end = start + timedelta(days=1)
    return start, end


class PostHogIntervalVerifier:
    """Verify the source interval when export metadata has no row count."""

    def __init__(self, settings: Settings):
        self.settings = settings

    def count_events(self, target_date: date) -> int | None:
        if not (self.settings.POSTHOG_API_KEY and self.settings.POSTHOG_PROJECT_ID):
            return None
        start, end = _date_range(target_date)
        query = (
            "SELECT count() AS row_count FROM events "
            f"WHERE timestamp >= toDateTime('{start.isoformat()}') "
            f"AND timestamp < toDateTime('{end.isoformat()}')"
        )
        request = Request(
            f"{self.settings.POSTHOG_HOST.rstrip('/')}/api/projects/"
            f"{self.settings.POSTHOG_PROJECT_ID}/query/",
            data=json.dumps({"query": {"kind": "HogQLQuery", "query": query}}).encode(),
            headers={
                "Authorization": f"Bearer {self.settings.POSTHOG_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urlopen(request, timeout=30) as response:
            payload = json.load(response)
        results = payload.get("results") or payload.get("result") or []
        if isinstance(results, list) and results and isinstance(results[0], list):
            return int(results[0][0])
        if isinstance(results, list) and results and isinstance(results[0], dict):
            return int(results[0].get("row_count", results[0].get("count", 0)))
        return 0


def _local_files(path: str) -> list[Path]:
    path_obj = Path(path)
    return sorted(path_obj.parent.glob(path_obj.name))


def _remote_files(path: str, settings: Settings) -> list[str]:
    if not path.startswith("s3://"):
        return []
    bucket, _, key_pattern = path[5:].partition("/")
    prefix = key_pattern.split("*", 1)[0]
    client = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY,
        aws_secret_access_key=settings.R2_SECRET_KEY,
        region_name="auto",
    )
    paginator = client.get_paginator("list_objects_v2")
    keys: list[str] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        keys.extend(
            f"s3://{bucket}/{obj['Key']}"
            for obj in page.get("Contents", [])
            if ".parquet" in obj["Key"]
        )
    return sorted(keys)


def _count_rows(files: Sequence[str | Path], settings: Settings) -> int:
    conn = duckdb.connect()
    try:
        paths = ", ".join("'" + str(path).replace("'", "''") + "'" for path in files)
        row = conn.execute(f"SELECT COUNT(*) FROM read_parquet([{paths}])").fetchone()
        return int(row[0]) if row else 0
    finally:
        conn.close()


def _configured_empty(target_date: date, settings: Settings) -> bool:
    return target_date.isoformat() in {
        value.strip() for value in settings.POSTHOG_EMPTY_DATES.split(",") if value.strip()
    }


@task(retries=3, retry_delay_seconds=60)
def check_posthog_files(
    target_date: date,
    path: str,
    settings: Settings | None = None,
    verifier: PostHogIntervalVerifier | None = None,
    use_verifier: bool = True,
) -> PostHogDelivery:
    """Classify the target interval as data, empty, pending, or failed.

    With ``use_verifier`` disabled, a file-less interval is pending without
    querying the source. Terminal-gap re-checks use this: they reopen only on
    arrived files or an attested-empty date, so a count that has aged out of
    PostHog retention can never be mistaken for confirmed no-event activity.
    """
    settings = settings or get_settings()
    try:
        files: Sequence[str | Path]
        if path.startswith(("s3://", "r2://")):
            files = _remote_files(path, settings)
        else:
            files = _local_files(path)

        if not files:
            if _configured_empty(target_date, settings):
                return PostHogDelivery(
                    SourceState.EMPTY, detail="configured authoritative empty interval"
                )
            if not use_verifier:
                return PostHogDelivery(
                    SourceState.PENDING, detail="PostHog export has not arrived"
                )
            verifier = verifier or PostHogIntervalVerifier(settings)
            source_count = verifier.count_events(target_date)
            if source_count == 0:
                return PostHogDelivery(
                    SourceState.EMPTY, row_count=0, detail="PostHog interval is empty"
                )
            return PostHogDelivery(
                SourceState.PENDING,
                row_count=source_count,
                detail="PostHog export has not arrived",
            )

        row_count = _count_rows(files, settings)
        if row_count == 0:
            return PostHogDelivery(SourceState.EMPTY, len(files), 0, "export contains zero rows")
        return PostHogDelivery(SourceState.DATA, len(files), row_count)
    except Exception as exc:
        logger.exception("PostHog completeness check failed date=%s", target_date)
        return PostHogDelivery(SourceState.FAILED, detail=str(exc))
