import pandas as pd

from backend.pipeline.parser import parse_section_grid


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