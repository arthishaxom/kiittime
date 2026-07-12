from datetime import time

import pytest
from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, ClassSession, Section, SnapshotStatus
from backend.pipeline.gold import ScopeViolationError, gold_upsert
from backend.pipeline.orchestrate import process_upload_and_apply
from backend.pipeline.resolve import resolve_all
from backend.pipeline.schemas import SessionRow
from backend.pipeline.scope import UpsertScope
from backend.pipeline.validate import ValidationError


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


def seed_gold(db: Session, resolved, day: str, period: int, start_time: time) -> None:
    db.add(
        ClassSession(
            section_id=resolved.section_id,
            course_id=resolved.course_id,
            faculty_id=resolved.faculty_id,
            room_id=resolved.room_id,
            day=day,
            period_number=period,
            start_time=start_time,
        )
    )
    db.flush()


def test_full_semester_scope_deletes_and_inserts(db):
    resolved = resolve_all(db, [make_row(period_number=1), make_row(period_number=2)])
    seed_gold(db, resolved[0], "Tue", 5, time(10, 0))
    before = db.query(ClassSession).count()

    result = gold_upsert(db, resolved, UpsertScope())

    assert result.deleted_count == before
    assert result.inserted_count == len(resolved)
    assert db.query(ClassSession).count() == len(resolved)


def test_single_section_scope_only_deletes_that_section(db):
    r1 = resolve_all(db, [make_row(section="CSE1", period_number=1)])
    r2 = resolve_all(db, [make_row(section="CSE2", period_number=1)])
    s1, s2 = r1[0].section_id, r2[0].section_id

    seed_gold(db, r1[0], "Tue", 9, time(9, 0))
    seed_gold(db, r2[0], "Tue", 9, time(9, 0))

    result = gold_upsert(db, r1, UpsertScope(section_ids=[s1]))

    assert result.deleted_count == 1
    # other section untouched
    assert db.query(ClassSession).filter_by(section_id=s2).count() == 1
    # this section now holds exactly the newly inserted row
    assert db.query(ClassSession).filter_by(section_id=s1).count() == 1


def test_scope_violation_raises_and_no_db_change(db):
    r1 = resolve_all(db, [make_row(section="CSE1", period_number=1)])
    r2 = resolve_all(db, [make_row(section="CSE2", period_number=1)])
    s2 = r2[0].section_id
    seed_gold(db, r2[0], "Wed", 3, time(11, 0))

    # scope only allows CSE1, but we feed it rows for both CSE1 and CSE2
    combined = r1 + r2
    before = db.query(ClassSession).count()

    with pytest.raises(ScopeViolationError):
        gold_upsert(db, combined, UpsertScope(section_ids=[r1[0].section_id]))

    # nothing was deleted or inserted
    assert db.query(ClassSession).count() == before
    assert db.query(ClassSession).filter_by(section_id=s2).count() == 1


def test_empty_resolved_clears_scope(db):
    r1 = resolve_all(db, [make_row(section="CSE1", period_number=1)])
    s1 = r1[0].section_id
    seed_gold(db, r1[0], "Thu", 4, time(12, 0))
    before = db.query(ClassSession).filter_by(section_id=s1).count()

    result = gold_upsert(db, [], UpsertScope(section_ids=[s1]))

    assert result.deleted_count == before
    assert result.inserted_count == 0
    assert db.query(ClassSession).filter_by(section_id=s1).count() == 0


def test_orchestrate_round_trip_moves_class(db):
    rows_v1 = [
        make_row(section="CSE1", period_number=1),
        make_row(section="CSE1", period_number=2),
    ]
    snapshot1, _ = process_upload_and_apply(db, rows_v1, UpsertScope(), source_filename="v1.xlsx")
    assert snapshot1.status == SnapshotStatus.approved

    section_id = db.query(Section).filter_by(section_name="CSE1", year=1).one().id
    periods_v1 = {c.period_number for c in db.query(ClassSession).filter_by(section_id=section_id)}
    assert periods_v1 == {1, 2}

    # v2 moves the period-1 class to period 3
    rows_v2 = [
        make_row(section="CSE1", period_number=3),
        make_row(section="CSE1", period_number=2),
    ]
    process_upload_and_apply(
        db, rows_v2, UpsertScope(section_ids=[section_id]), source_filename="v2.xlsx"
    )

    periods_v2 = {c.period_number for c in db.query(ClassSession).filter_by(section_id=section_id)}
    assert periods_v2 == {2, 3}  # old slot (1) gone, new slot (3) present


def test_orchestrate_failure_rolls_back_and_rejects(db):
    # baseline committed gold row
    r1 = resolve_all(db, [make_row(section="CSE1", period_number=1)])
    s1 = r1[0].section_id
    seed_gold(db, r1[0], "Mon", 1, time(8, 0))
    baseline_gold = db.query(ClassSession).count()

    # second upload conflicts on the same slot within the batch -> ValidationError
    rows = [
        make_row(period_number=1, course_code="DBMS"),
        make_row(period_number=1, course_code="OS"),
    ]
    with pytest.raises(ValidationError):
        process_upload_and_apply(
            db, rows, UpsertScope(section_ids=[s1]), source_filename="bad.xlsx"
        )

    # gold table unchanged (no partial apply)
    assert db.query(ClassSession).count() == baseline_gold
    # bronze snapshot preserved and marked rejected
    snap = db.query(BronzeSnapshot).filter_by(source_filename="bad.xlsx").one()
    assert snap.status == SnapshotStatus.rejected
