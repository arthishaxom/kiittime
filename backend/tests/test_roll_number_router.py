import pytest
from fastapi.testclient import TestClient

from backend.db.models import RollNumberMapping, Section
from backend.db.session import get_db
from backend.main import app


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_lookup_roll_number_empty_db(client, db):
    # DB is completely empty (no sections exist)
    from backend.db.models import ClassSession

    db.query(ClassSession).delete()
    db.query(RollNumberMapping).delete()
    db.query(Section).delete()
    db.flush()

    response = client.get("/api/roll-numbers/2105123")
    assert response.status_code == 404
    assert response.json()["detail"] == "No timetables uploaded yet"


def test_lookup_roll_number_not_found(client, db):
    # DB has sections but mapping is missing
    section = Section(section_name="CS1", year=2)
    db.add(section)
    db.flush()

    response = client.get("/api/roll-numbers/2105123")
    assert response.status_code == 404
    assert response.json()["detail"] == "Roll number not found"


def test_lookup_roll_number_success(client, db):
    # DB has sections and mapping exists
    section = Section(section_name="CS1", year=2)
    db.add(section)
    db.flush()

    mapping = RollNumberMapping(roll_no="2105123", section_id=section.id, academic_year=2)
    db.add(mapping)
    db.flush()

    response = client.get("/api/roll-numbers/2105123")
    assert response.status_code == 200

    data = response.json()
    assert data["roll_no"] == "2105123"
    assert data["academic_year"] == 2
    assert len(data["sections"]) == 1
    assert data["sections"][0]["section_name"] == "CS1"


def test_lookup_roll_number_multiple_sections(client, db):
    # DB has sections and multiple mappings exist for a single roll number
    section1 = Section(section_name="CS1", year=2)
    section2 = Section(section_name="HPC1", year=2)
    db.add(section1)
    db.add(section2)
    db.flush()

    mapping1 = RollNumberMapping(roll_no="2105123", section_id=section1.id, academic_year=2)
    mapping2 = RollNumberMapping(roll_no="2105123", section_id=section2.id, academic_year=2)
    db.add_all([mapping1, mapping2])
    db.flush()

    response = client.get("/api/roll-numbers/2105123")
    assert response.status_code == 200

    data = response.json()
    assert data["roll_no"] == "2105123"
    assert data["academic_year"] == 2
    assert len(data["sections"]) == 2
    section_names = {s["section_name"] for s in data["sections"]}
    assert section_names == {"CS1", "HPC1"}
