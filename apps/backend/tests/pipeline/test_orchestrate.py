import pytest

from backend.db.models import SnapshotStatus
from backend.pipeline.orchestrate import process_upload
from backend.pipeline.schemas import SessionRow
from backend.pipeline.validate import ValidationError


def make_row(**overrides) -> SessionRow:
    defaults = dict(
        year=2026,
        section="CSE1",
        day="Mon",
        period_number=1,
        start_time="08:00",
        course_code="DBMS",
        faculty_name="Dr. Test",
        room_number="C25-B001",
    )
    defaults.update(overrides)
    return SessionRow(**defaults)


def test_successful_upload_returns_snapshot_and_resolved_sessions(db):
    rows = [make_row(period_number=1), make_row(period_number=2)]
    snapshot, resolved = process_upload(db, rows, source_filename="test.xlsx")

    assert snapshot.status == SnapshotStatus.pending
    assert len(resolved) == 2


def test_validation_failure_marks_snapshot_rejected_but_keeps_it(db):
    rows = [
        make_row(period_number=1, course_code="DBMS"),
        make_row(period_number=1, course_code="OS"),  # same slot, conflict
    ]

    with pytest.raises(ValidationError):
        process_upload(db, rows, source_filename="bad.xlsx")

    # bronze snapshot should still exist and be marked rejected, not vanished
    from backend.db.models import BronzeSnapshot

    snapshot = db.query(BronzeSnapshot).filter_by(source_filename="bad.xlsx").one()
    assert snapshot.status == SnapshotStatus.rejected
