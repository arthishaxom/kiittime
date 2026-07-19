import re
from datetime import time

import pandas as pd

from backend.pipeline.schemas import SessionRow

_PERIOD_V2 = re.compile(r"P(\d+) \((\d{1,2}):(\d{2}) (AM|PM)-\d{1,2}:\d{2} (?:AM|PM)\)")
_PERIOD_V1 = re.compile(r"P(\d+)\n(\d{2}):(\d{2})")
WEEKDAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}


def parse_period_column(col_name: str) -> tuple[int, time]:
    """Parse a raw period column header into (period_number, start_time).

    Supported formats:
      v1: ``P1\\n08:00``           — 24hr, newline-separated
      v2: ``P1 (8:00 AM-9:00 AM)`` — 12hr AM/PM, space-separated
    """
    match = _PERIOD_V2.match(col_name)
    if match:
        period_number = int(match.group(1))
        hour = int(match.group(2))
        minute = int(match.group(3))
        meridiem = match.group(4)
        if meridiem == "AM" and hour == 12:
            hour = 0
        elif meridiem == "PM" and hour != 12:
            hour += 12
        return period_number, time(hour, minute)

    match = _PERIOD_V1.match(col_name)
    if match:
        period_number = int(match.group(1))
        hour, minute = int(match.group(2)), int(match.group(3))
        return period_number, time(hour, minute)

    raise ValueError(f"Unrecognized period column format: {col_name!r}")


def parse_cell(raw: str) -> tuple[str, str, str]:
    """Parse a raw cell like 'DL\\nDr. X\\nC25-B006'.

    Into (course_code, faculty_name, room_number).
    """
    parts = raw.split("\n")
    assert len(parts) == 3, f"Unexpected cell format: {raw!r}"
    course_code, faculty_name, room_number = parts
    return course_code, faculty_name, room_number


def _row_to_session(row: pd.Series) -> SessionRow:
    period_number, start_time = parse_period_column(row["Period"])
    course_code, faculty_name, room_number = parse_cell(row["Cell"])
    return SessionRow(
        year=row["Year"],
        section=row["Section"],
        day=row["Day"],
        period_number=period_number,
        start_time=start_time,
        course_code=course_code,
        faculty_name=faculty_name,
        room_number=room_number,
    )


def parse_section_grid(df: pd.DataFrame, year: int) -> list[SessionRow]:
    """Parse a wide-format section grid sheet into a list of SessionRow."""
    is_title_row = ~df["Day"].isin(WEEKDAYS)
    df_clean = df[~is_title_row].reset_index(drop=True)

    period_cols = [c for c in df_clean.columns if c not in ("Section", "Day")]

    long_df = (
        df_clean.melt(
            id_vars=["Section", "Day"],
            value_vars=period_cols,
            var_name="Period",
            value_name="Cell",
        )
        .dropna(subset=["Cell"])
        .reset_index(drop=True)
    )

    long_df["Year"] = year

    return [_row_to_session(row) for _, row in long_df.iterrows()]
