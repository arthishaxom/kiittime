import io
import re
from datetime import time

import pdfplumber

from backend.pipeline.schemas import SessionRow


def parse_normal_cell(
    cell_text: str, current_day: str, period_number: int, section: str, year: int
) -> SessionRow | None:
    lines = [line.strip() for line in cell_text.split("\n") if line.strip()]
    if len(lines) < 3:
        return None

    timing_line = lines[0]
    if " - " not in timing_line:
        return None

    start_time_str = timing_line.split(" - ")[0].strip()
    try:
        h, m = map(int, start_time_str.split(":"))
        start_time_obj = time(h, m)
    except ValueError:
        return None

    course_code = lines[1]

    room_lines = []
    in_room = False
    for line in lines[2:]:
        if line.startswith("Room:"):
            in_room = True
            val = line[5:].strip()
            if val:
                room_lines.append(val)
        elif in_room:
            room_lines.append(line)

    if not room_lines:
        return None

    # Remove empty strings and join
    room_number = " ".join([r for r in room_lines if r])

    return SessionRow(
        year=year,
        section=section,
        day=current_day,
        period_number=period_number,
        start_time=start_time_obj,
        course_code=course_code,
        faculty_name=None,
        room_number=room_number,
    )


def parse_elective_cell(
    cell_text: str, inherited_day: str, inherited_period: int, inherited_start: time, year: int
) -> SessionRow | None:
    lines = [line.strip() for line in cell_text.split("\n") if line.strip()]
    if len(lines) < 3:
        return None

    section = lines[0]
    course_code = re.sub(r"-\d+$", "", section)

    room_lines = []
    in_room = False
    for line in lines[1:]:
        if line.startswith("Room:"):
            in_room = True
            val = line[5:].strip()
            if val:
                room_lines.append(val)
        elif in_room:
            room_lines.append(line)

    if not room_lines:
        return None

    room_number = " ".join([r for r in room_lines if r])

    return SessionRow(
        year=year,
        section=section,
        day=inherited_day,
        period_number=inherited_period,
        start_time=inherited_start,
        course_code=course_code,
        faculty_name=None,
        room_number=room_number,
    )


def parse_pdf_timetable(file_bytes: bytes, year: int) -> list[SessionRow]:
    rows: list[SessionRow] = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        current_section = None
        col_to_period = {}

        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.split("\n")
            first_line = lines[0].strip() if lines else ""

            match = re.search(r"Section\s+(\S+)", first_line)
            if match:
                current_section = match.group(1)

            if not current_section:
                continue

            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue

                headers = table[0]
                has_headers = bool(
                    headers and headers[0] and isinstance(headers[0], str) and "Day" in headers[0]
                )

                start_idx = 1 if has_headers else 0

                if has_headers:
                    col_to_period.clear()
                    current_period = None
                    for i, header in enumerate(headers):
                        if header and isinstance(header, str) and header.startswith("Period"):
                            p_match = re.search(r"Period\s+(\d+)", header)
                            if p_match:
                                current_period = int(p_match.group(1))
                        if current_period is not None:
                            col_to_period[i] = current_period

                current_day = None
                active_electives = {}

                for row in table[start_idx:]:
                    if not row or not any(row):
                        continue

                    day_cell = row[0]
                    if day_cell and isinstance(day_cell, str) and day_cell.strip():
                        day_str = day_cell.strip()
                        if day_str in {
                            "Monday",
                            "Tuesday",
                            "Wednesday",
                            "Thursday",
                            "Friday",
                            "Saturday",
                            "Sunday",
                        }:
                            current_day = day_str
                            active_electives.clear()

                    if not current_day:
                        continue

                    for col_idx, cell_text in enumerate(row[1:], start=1):
                        if not cell_text or not str(cell_text).strip():
                            continue

                        cell_text = str(cell_text).strip()
                        period_number = col_to_period.get(col_idx)
                        if period_number is None:
                            continue

                        first_cell_line = cell_text.split("\n")[0].strip()

                        if " - Elective" in first_cell_line:
                            start_time_str = first_cell_line.split(" - ")[0].strip()
                            try:
                                h, m = map(int, start_time_str.split(":"))
                                active_electives[period_number] = time(h, m)
                            except ValueError:
                                pass
                            continue

                        if " - " in first_cell_line and re.match(
                            r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}", first_cell_line
                        ):
                            session_row = parse_normal_cell(
                                cell_text, current_day, period_number, current_section, year
                            )
                            if session_row:
                                rows.append(session_row)
                            continue

                        if period_number in active_electives:
                            inherited_start = active_electives[period_number]
                            session_row = parse_elective_cell(
                                cell_text, current_day, period_number, inherited_start, year
                            )
                            if session_row:
                                rows.append(session_row)

    # Deduplicate rows by all attributes
    seen: set[tuple[int, str, str, int, time, str, str]] = set()
    unique_rows: list[SessionRow] = []
    for r in rows:
        key = (
            r.year,
            r.section,
            r.day,
            r.period_number,
            r.start_time,
            r.course_code,
            r.room_number,
        )
        if key not in seen:
            seen.add(key)
            unique_rows.append(r)

    return unique_rows
