"""Read-only audit access to the retired R2 per-stage control object.

The nightly flow no longer reads or writes ``_metadata/pipeline_runs.parquet``;
completion is derived from the Analytics Serving Snapshot and the Gap Ledger.
This module is the migration and audit path for the retired object: it reads
the object's Terminal Gap rows (``stage='serving'``, ``status='skipped'``) so
they can be imported into the Gap Ledger and verified against it. It never
writes the object.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import duckdb

from analytics.config import Settings
from analytics.gaps import POSTHOG_SOURCE, GapRecord, PostgresGapRepository

CONTROL_OBJECT_KEY = "_metadata/pipeline_runs.parquet"

GAP_STAGE = "serving"
GAP_STATUS = "skipped"
MIGRATED_REASON = "migrated from the retired R2 control object (no reason recorded)"


def control_object_path(settings: Settings) -> str:
    """The retired R2 control object, retained read-only as audit history."""
    return f"s3://{settings.R2_BUCKET_NAME}/{CONTROL_OBJECT_KEY}"


SKIP_ROWS_QUERY = """
    SELECT date, COALESCE(source, ?) AS source,
           COALESCE(reason, ?) AS reason, processed_at
    FROM pipeline_runs
    WHERE stage = ? AND status = ?
    ORDER BY date, source
"""


@dataclass(frozen=True)
class MigrationReport:
    """Parity between the retired object's skip rows and the Gap Ledger."""

    object_gaps: list[GapRecord]
    ledger_gaps: list[GapRecord]
    migrated: list[GapRecord]
    already_present: list[GapRecord]

    @property
    def missing_from_ledger(self) -> list[GapRecord]:
        ledger = {(gap.date, gap.source) for gap in self.ledger_gaps}
        return [gap for gap in self.object_gaps if (gap.date, gap.source) not in ledger]

    @property
    def extra_in_ledger(self) -> list[GapRecord]:
        object_keys = {(gap.date, gap.source) for gap in self.object_gaps}
        return [gap for gap in self.ledger_gaps if (gap.date, gap.source) not in object_keys]

    @property
    def reason_drift(self) -> list[GapRecord]:
        ledger = {(gap.date, gap.source): gap.reason for gap in self.ledger_gaps}
        return [
            gap
            for gap in self.object_gaps
            if (gap.date, gap.source) in ledger and ledger[(gap.date, gap.source)] != gap.reason
        ]

    @property
    def matches(self) -> bool:
        return not self.missing_from_ledger


def _load_object(conn: duckdb.DuckDBPyConnection, path: str) -> None:
    """Load the object into ``pipeline_runs``; fail when it is absent.

    Only IO failures (missing or unreadable object) are reported as not found;
    credential and network failures keep their own exception so they cannot be
    mistaken for an absent audit object. Objects written before the reason
    column existed are extended with it, without altering the stored file.
    """
    try:
        conn.execute("SELECT 1 FROM read_parquet(?) LIMIT 1", [path])
    except duckdb.IOException as exc:
        raise FileNotFoundError(f"R2 control object is missing or unreadable: {path}") from exc
    conn.execute(
        "CREATE OR REPLACE TEMP TABLE pipeline_runs AS SELECT * FROM read_parquet(?)",
        [path],
    )
    conn.execute("ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS reason VARCHAR")


def _as_utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(UTC)
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def read_skip_rows(conn: duckdb.DuckDBPyConnection, path: str) -> list[GapRecord]:
    """Terminal Gap rows (``serving=skipped``) from the retired object, oldest first."""
    _load_object(conn, path)
    rows = conn.execute(
        SKIP_ROWS_QUERY,
        [POSTHOG_SOURCE, MIGRATED_REASON, GAP_STAGE, GAP_STATUS],
    ).fetchall()
    return [
        GapRecord(day, source, reason, _as_utc(processed_at))
        for day, source, reason, processed_at in rows
    ]


def migrate_control_gaps(
    conn: duckdb.DuckDBPyConnection,
    path: str,
    repository: PostgresGapRepository,
) -> MigrationReport:
    """Upsert the object's Terminal Gap rows into the ledger, then verify parity.

    Existing decisions are left untouched, so re-running the migration never
    duplicates or rewrites a gap row. The object itself is never written.
    """
    gaps = read_skip_rows(conn, path)
    existing = {(gap.date, gap.source) for gap in repository.all_gaps()}
    migrated = [gap for gap in gaps if (gap.date, gap.source) not in existing]
    already_present = [gap for gap in gaps if (gap.date, gap.source) in existing]
    for gap in gaps:
        repository.record_gap(gap.date, gap.source, gap.reason, decided_at=gap.decided_at)
    return MigrationReport(gaps, repository.all_gaps(), migrated, already_present)


def verify_control_gaps(
    conn: duckdb.DuckDBPyConnection,
    path: str,
    repository: PostgresGapRepository,
) -> MigrationReport:
    """Read-only parity check: every object skip row must be in the Gap Ledger.

    Ledger rows newer than the object and reworded reasons are reported but do
    not fail the check, because the ledger is live and the object is history.
    """
    gaps = read_skip_rows(conn, path)
    return MigrationReport(gaps, repository.all_gaps(), [], [])
