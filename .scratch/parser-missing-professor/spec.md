# Feature: Handle Missing Professor Names in Parser

## Background
The timetable Excel sheets occasionally have cells with missing professor names. These cells contain only 2 lines instead of the expected 3:
1. Course code
2. Room number

Currently, the parser strictly asserts that a cell has exactly 3 lines and crashes when this format is encountered.

## Requirements
- Allow parsing of cells with 2 lines, extracting the 1st line as `course_code` and the 2nd line as `room_number`.
- Set the missing faculty name to `NULL`.
- Fail fast if a cell has 1 line, or 4 or more lines.
- Update the backend data schemas to accept a `NULL` faculty name and a `NULL` faculty ID.
- Generate an Alembic database migration to change the `ClassSession.faculty_id` column to be nullable.

## Decisions Made
- `SessionRow.faculty_name` becomes `str | None`.
- Cells with 1 or 4+ lines continue to raise hard errors (fail fast).
- `ClassSession.faculty_id` is updated to be nullable, rather than mapping to a dummy "Unknown" faculty.
