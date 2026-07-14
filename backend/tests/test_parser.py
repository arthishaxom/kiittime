from datetime import time

import pandas as pd
import pytest

from backend.pipeline.parser import parse_period_column, parse_section_grid


def make_mock_grid() -> pd.DataFrame:
    data = {
        "Section": ["Sem 7 | CS-S7 | CS1", "CS1", "CS1", "CS1", "CS1", "CS1"],
        "Day": ["2 course group(s)", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "P1\n08:00": [None, "DL\nDr. Test Faculty\nC25-B001", None, None, None, None],
        "P2\n09:00": [None, None, "EPP\nMs. Test Prof\nC25-B002", None, None, None],
    }
    return pd.DataFrame(data)


def test_parse_section_grid_row_count():
    df = make_mock_grid()
    sessions = parse_section_grid(df, year=2)
    assert len(sessions) == 2


def test_parse_section_grid_monday_session():
    df = make_mock_grid()
    sessions = parse_section_grid(df, year=2)
    monday = next(s for s in sessions if s.day == "Monday")
    assert monday.course_code == "DL"
    assert monday.faculty_name == "Dr. Test Faculty"
    assert monday.room_number == "C25-B001"


def test_parse_period_column_v1():
    assert parse_period_column("P1\n08:00") == (1, time(8, 0))


def test_parse_period_column_v2_am():
    assert parse_period_column("P1 (8:00 AM-9:00 AM)") == (1, time(8, 0))


def test_parse_period_column_v2_pm():
    assert parse_period_column("P3 (1:00 PM-2:00 PM)") == (3, time(13, 0))


def test_parse_period_column_v2_noon():
    assert parse_period_column("P1 (12:00 PM-1:00 PM)") == (1, time(12, 0))


def test_parse_period_column_v2_midnight():
    assert parse_period_column("P5 (12:00 AM-1:00 AM)") == (5, time(0, 0))


def test_parse_period_column_invalid():
    with pytest.raises(ValueError):
        parse_period_column("garbage")
