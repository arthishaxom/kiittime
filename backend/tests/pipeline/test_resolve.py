from backend.db.models import Course, Faculty, Room, Section
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


def test_creates_new_entities_when_none_exist(db):
    rows = [make_row()]
    resolved = resolve_all(db, rows)

    assert len(resolved) == 1
    assert db.query(Course).filter_by(course_code="DBMS").one().course_name is None
    assert db.query(Faculty).filter_by(faculty_name="Dr. Test").count() == 1
    assert db.query(Room).filter_by(room_number="C25-B001").count() == 1
    assert db.query(Section).filter_by(section_name="CSE1", year=1).count() == 1


def test_reuses_existing_entities_no_duplicates(db):
    existing = Course(course_code="DBMS", course_name=None)
    db.add(existing)
    db.flush()

    rows = [make_row(course_code="DBMS")]
    resolved = resolve_all(db, rows)

    assert resolved[0].course_id == existing.id
    assert db.query(Course).filter_by(course_code="DBMS").count() == 1


def test_dedupes_repeated_references_within_one_upload(db):
    rows = [
        make_row(period_number=1, course_code="DBMS", faculty_name="Dr. Test"),
        make_row(period_number=2, course_code="DBMS", faculty_name="Dr. Test"),
    ]
    resolved = resolve_all(db, rows)

    assert db.query(Course).filter_by(course_code="DBMS").count() == 1
    assert resolved[0].course_id == resolved[1].course_id


def test_different_rooms_same_course_resolve_independently(db):
    rows = [
        make_row(period_number=1, room_number="C25-B001"),
        make_row(period_number=2, room_number="C25-B002"),
    ]
    resolved = resolve_all(db, rows)

    assert resolved[0].room_id != resolved[1].room_id
    assert db.query(Room).count() == 2


def test_section_composite_key_same_name_different_year(db):
    rows = [
        make_row(section="CSE1", year=1),
        make_row(section="CSE1", year=2),
    ]
    resolved = resolve_all(db, rows)

    assert resolved[0].section_id != resolved[1].section_id
    assert db.query(Section).count() == 2
