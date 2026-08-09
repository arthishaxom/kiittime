from pathlib import Path

from backend.pipeline.pdf_parser import parse_pdf_timetable


def test_parse_pdf_timetable():
    pdf_path = Path("/home/justashish/Dev/kiittime/Section wise_Timetable_Scheme A_05-07-26.pdf")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    sessions = parse_pdf_timetable(pdf_bytes, year=2026)
    assert isinstance(sessions, list)
    assert len(sessions) > 0

    sections = {s.section for s in sessions}
    assert "A1" in sections
    assert "A2" in sections

    # Check a specific session (e.g. BCE-01 elective from A2)
    bce_sessions = [s for s in sessions if s.section == "BCE-01"]
    assert len(bce_sessions) > 0
    for s in bce_sessions:
        assert s.course_code == "BCE"
        assert s.year == 2026
