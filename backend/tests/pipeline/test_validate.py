import pytest
from datetime import time

from backend.pipeline.resolve import ResolvedSession
from backend.pipeline.validate import ValidationError, validate_resolved_sessions


def make_resolved(**overrides) -> ResolvedSession:
    defaults = dict(
        section_id=1, course_id=1, faculty_id=1, room_id=1,
        day="Mon", period_number=1, start_time=time(8, 0),
    )
    defaults.update(overrides)
    return ResolvedSession(**defaults)


def test_no_conflict_passes_silently():
    sessions = [
        make_resolved(period_number=1),
        make_resolved(period_number=2),
    ]
    validate_resolved_sessions(sessions)  # should not raise


def test_duplicate_slot_raises_validation_error():
    sessions = [
        make_resolved(section_id=1, day="Mon", period_number=1, course_id=1),
        make_resolved(section_id=1, day="Mon", period_number=1, course_id=2),
    ]
    with pytest.raises(ValidationError):
        validate_resolved_sessions(sessions)


def test_same_period_different_sections_is_fine():
    sessions = [
        make_resolved(section_id=1, day="Mon", period_number=1),
        make_resolved(section_id=2, day="Mon", period_number=1),
    ]
    validate_resolved_sessions(sessions)  # should not raise, different sections
