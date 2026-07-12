import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, SnapshotStatus
from backend.pipeline.bronze import write_bronze_snapshot
from backend.pipeline.schemas import SessionRow


@pytest.fixture
def db():
    import os
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


def make_row(**overrides) -> SessionRow:
    defaults = dict(
        year=2026, section="CSE1", day="Mon", period_number=1,
        start_time="08:00", course_code="DBMS", faculty_name="Dr. Test",
        room_number="C25-B001",
    )
    defaults.update(overrides)
    return SessionRow(**defaults)


def test_writes_snapshot_with_pending_status(db):
    rows = [make_row()]
    snapshot = write_bronze_snapshot(
        db, rows, source_filename="test.xlsx", uploaded_by="tester"
    )

    assert snapshot.id is not None
    assert snapshot.status == SnapshotStatus.pending
    assert snapshot.source_filename == "test.xlsx"
    assert snapshot.uploaded_by == "tester"


def test_scope_section_ids_captures_distinct_sections(db):
    rows = [
        make_row(section="CSE1", period_number=1),
        make_row(section="CSE1", period_number=2),
        make_row(section="CSE2", period_number=1),
    ]
    snapshot = write_bronze_snapshot(db, rows, source_filename="test.xlsx")

    assert sorted(snapshot.scope_section_ids) == ["CSE1", "CSE2"]


def test_parsed_data_round_trips_row_count(db):
    rows = [make_row(period_number=i) for i in range(1, 4)]
    snapshot = write_bronze_snapshot(db, rows, source_filename="test.xlsx")

    assert len(snapshot.parsed_data) == 3


def test_persisted_snapshot_retrievable_after_flush(db):
    rows = [make_row()]
    snapshot = write_bronze_snapshot(db, rows, source_filename="test.xlsx")

    fetched = db.get(BronzeSnapshot, snapshot.id)
    assert fetched is not None
    assert fetched.source_filename == "test.xlsx"
