"""One-off migration of retired R2 control-object gap rows into the Gap Ledger.

Run once during rollout, then use ``--verify-only`` to re-check parity without
writing. The R2 object is never written; it is retained read-only as audit.

    uv run python scripts/migrate_r2_control.py
    uv run python scripts/migrate_r2_control.py --verify-only
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SRC = str(ROOT / "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from analytics.config import get_duckdb_conn, get_settings  # noqa: E402
from analytics.control import (  # noqa: E402
    MigrationReport,
    control_object_path,
    migrate_control_gaps,
    verify_control_gaps,
)
from analytics.gaps import GapRecord, PostgresGapRepository  # noqa: E402


def _format(gaps: list[GapRecord]) -> str:
    return ", ".join(f"{gap.date.isoformat()}/{gap.source}" for gap in gaps) or "none"


def _print_report(report: MigrationReport, path: str, verify_only: bool) -> None:
    print(f"Control object (read-only): {path}")
    print(f"Terminal Gap rows in object: {len(report.object_gaps)}")
    if not verify_only:
        print(f"Migrated into the Gap Ledger: {len(report.migrated)} ({_format(report.migrated)})")
        print(
            f"Already in the Gap Ledger: {len(report.already_present)} "
            f"({_format(report.already_present)})"
        )
    print(f"Ledger gaps newer than the object: {len(report.extra_in_ledger)}")
    print(f"Reworded reasons: {len(report.reason_drift)} ({_format(report.reason_drift)})")
    if report.matches:
        print("Verification OK: every object skip row is present in the Gap Ledger.")
    else:
        print(f"Verification FAILED: missing -> {_format(report.missing_from_ledger)}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate retired R2 control-object gap rows into the Gap Ledger."
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="check parity without writing to the Gap Ledger",
    )
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    settings = get_settings()
    path = control_object_path(settings)
    repository = PostgresGapRepository(settings)
    conn = get_duckdb_conn(settings)
    try:
        if args.verify_only:
            report = verify_control_gaps(conn, path, repository)
        else:
            report = migrate_control_gaps(conn, path, repository)
    finally:
        conn.close()

    _print_report(report, path, args.verify_only)
    return 0 if report.matches else 1


if __name__ == "__main__":
    raise SystemExit(main())
