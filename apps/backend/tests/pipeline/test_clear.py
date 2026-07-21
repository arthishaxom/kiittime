from datetime import time

from backend.db.models import (
    BronzeSnapshot,
    ClassSession,
    Course,
    Faculty,
    Room,
    Section,
    SnapshotStatus,
)
from backend.pipeline.clear import clear_all
from backend.pipeline.resolve import resolve_all
from backend.pipeline.schemas import SessionRow


def make_row(**overrides) -> SessionRow:
    defaults = dict(
        year=1,
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


def test_clear_all_wipes_every_gold_and_bronze_table(db):
    resolved = resolve_all(db, [make_row()])
    db.add(
        ClassSession(
            section_id=resolved[0].section_id,
            course_id=resolved[0].course_id,
            faculty_id=resolved[0].faculty_id,
            room_id=resolved[0].room_id,
            day="Mon",
            period_number=1,
            start_time=time(8, 0),
        )
    )
    db.add(
        BronzeSnapshot(
            source_filename="test.xlsx",
            scope_section_ids=[],
            parsed_data=[],
            status=SnapshotStatus.approved,
        )
    )
    db.flush()

    sessions_before = db.query(ClassSession).count()
    sections_before = db.query(Section).count()
    courses_before = db.query(Course).count()
    faculty_before = db.query(Faculty).count()
    rooms_before = db.query(Room).count()
    snapshots_before = db.query(BronzeSnapshot).count()

    result = clear_all(db)

    assert result.class_sessions_deleted == sessions_before
    assert result.sections_deleted == sections_before
    assert result.courses_deleted == courses_before
    assert result.faculty_deleted == faculty_before
    assert result.rooms_deleted == rooms_before
    assert result.bronze_snapshots_deleted == snapshots_before

    assert db.query(ClassSession).count() == 0
    assert db.query(Section).count() == 0
    assert db.query(Course).count() == 0
    assert db.query(Faculty).count() == 0
    assert db.query(Room).count() == 0
    assert db.query(BronzeSnapshot).count() == 0
