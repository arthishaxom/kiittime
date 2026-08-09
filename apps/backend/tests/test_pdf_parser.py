from collections import Counter
from datetime import time
from pathlib import Path

from backend.pipeline.pdf_parser import parse_pdf_timetable

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "Section wise_Timetable_Scheme A_05-07-26.pdf"


def test_parse_pdf_timetable_fixture_smoke():
    with open(FIXTURE_PATH, "rb") as f:
        pdf_bytes = f.read()

    sessions = parse_pdf_timetable(pdf_bytes, year=2026)
    assert isinstance(sessions, list)
    assert len(sessions) > 0

    sections = {s.section for s in sessions}
    # Check parent sections
    assert "A1" in sections
    assert "A2" in sections
    assert "A33" in sections

    # Check elective sub-sections
    assert "BCE-01" in sections
    assert "BCE-02" in sections
    assert "BI-01" in sections
    assert "BME-01" in sections
    assert "IA-01" in sections


def test_parse_pdf_timetable_attributes():
    with open(FIXTURE_PATH, "rb") as f:
        pdf_bytes = f.read()

    sessions = parse_pdf_timetable(pdf_bytes, year=2026)

    # 1. Faculty name is always None
    for s in sessions:
        assert s.faculty_name is None
        assert s.year == 2026
        assert isinstance(s.start_time, time)
        assert isinstance(s.period_number, int)
        assert s.day in {
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        }

    # 2. Check normal session course codes and room names in Section A1
    a1_sessions = [s for s in sessions if s.section == "A1"]
    assert len(a1_sessions) > 0

    # PL(T) & Programming Lab in A1 Monday Period 1
    mon_p1 = next(s for s in a1_sessions if s.day == "Monday" and s.period_number == 1)
    assert mon_p1.course_code == "PL(T) & Programming Lab"
    assert mon_p1.start_time == time(8, 0)
    assert mon_p1.room_number == "Campus-15(A), C15-A-LAB-201"

    # C&DE; in A1 Monday Period 2
    mon_p2 = next(s for s in a1_sessions if s.day == "Monday" and s.period_number == 2)
    assert mon_p2.course_code == "C&DE;"
    assert mon_p2.start_time == time(11, 20)
    assert mon_p2.room_number == "Campus-15(B), B-301"


def test_parse_pdf_timetable_elective_sub_sections():
    with open(FIXTURE_PATH, "rb") as f:
        pdf_bytes = f.read()

    sessions = parse_pdf_timetable(pdf_bytes, year=2026)

    # Check BCE-01 sub-section: course code stripped from BCE-01 -> BCE
    bce_sessions = [s for s in sessions if s.section == "BCE-01"]
    assert len(bce_sessions) > 0
    for s in bce_sessions:
        assert s.course_code == "BCE"
        assert s.faculty_name is None
        assert s.year == 2026

    # BI-01 -> BI
    bi_sessions = [s for s in sessions if s.section == "BI-01"]
    assert len(bi_sessions) > 0
    for s in bi_sessions:
        assert s.course_code == "BI"

    # IA-01 -> IA
    ia_sessions = [s for s in sessions if s.section == "IA-01"]
    assert len(ia_sessions) > 0
    for s in ia_sessions:
        assert s.course_code == "IA"


def test_parse_pdf_timetable_no_duplicate_slots():
    with open(FIXTURE_PATH, "rb") as f:
        pdf_bytes = f.read()

    sessions = parse_pdf_timetable(pdf_bytes, year=2026)

    # Validate that no section has two sessions at the same (section, day, period_number)
    slot_counts = Counter((s.section, s.day, s.period_number) for s in sessions)
    conflicts = [slot for slot, count in slot_counts.items() if count > 1]
    assert conflicts == []
