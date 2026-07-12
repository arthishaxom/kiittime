import re
from datetime import time

import pandas as pd

from backend.pipeline.schemas import SessionRow

PERIOD_COLUMN_PATTERN = re.compile(r"P(\d+)\n(\d{2}):(\d{2})")
WEEKDAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday"}


def parse_period_column(col_name: str) -> tuple[int, time]:
    """Parse a raw period column header like 'P1\\n08:00' into (1, time(8, 0))."""
    match = PERIOD_COLUMN_PATTERN.match(col_name)
    assert match, f"Unexpected period column format: {col_name!r}"
    period_number = int(match.group(1))
    hour, minute = int(match.group(2)), int(match.group(3))
    return period_number, time(hour, minute)


def parse_cell(raw: str) -> tuple[str, str, str]:
    """Parse a raw cell like 'DL\\nDr. X\\nC25-B006' into (course_code, faculty_name, room_number)."""
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

    long_df = df_clean.melt(
        id_vars=["Section", "Day"],
        value_vars=period_cols,
        var_name="Period",
        value_name="Cell",
    ).dropna(subset=["Cell"]).reset_index(drop=True)

    long_df["Year"] = year

    return [_row_to_session(row) for _, row in long_df.iterrows()]