from backend.db.models import RollNumberMapping, Section


def test_create_roll_number_mapping(db):
    # Setup: create a section
    section = Section(section_name="CS1", year=2)
    db.add(section)
    db.flush()

    # Test creating mapping
    mapping = RollNumberMapping(roll_no="2105123", section_id=section.id, academic_year=2)
    db.add(mapping)
    db.flush()

    assert mapping.id is not None
    assert mapping.roll_no == "2105123"
    assert mapping.section_id == section.id
    assert mapping.academic_year == 2


def test_unique_roll_number_mapping(db):
    import pytest
    from sqlalchemy.exc import IntegrityError

    section = Section(section_name="CS1", year=2)
    db.add(section)
    db.flush()

    mapping1 = RollNumberMapping(roll_no="2105123", section_id=section.id, academic_year=2)
    db.add(mapping1)
    db.flush()

    mapping2 = RollNumberMapping(roll_no="2105123", section_id=section.id, academic_year=2)
    db.add(mapping2)

    with pytest.raises(IntegrityError):
        db.flush()
