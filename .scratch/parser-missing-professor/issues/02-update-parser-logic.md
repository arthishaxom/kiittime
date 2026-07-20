# 02-update-parser-logic

Status: resolved
Type: task
Blocked by: 01

## Context
The parser crashes on cells that don't have exactly 3 lines. We need to gracefully handle 2-line cells (missing professor name) while failing fast on other irregular lengths.

## Requirements
1. Update `parse_cell` in `backend/src/backend/pipeline/parser.py`:
   - If `len(parts) == 3`, return `(parts[0], parts[1], parts[2])`.
   - If `len(parts) == 2`, return `(parts[0], None, parts[1])`.
   - Else, raise an AssertionError (fail fast).
2. Update `resolve_all` in `backend/src/backend/pipeline/resolve.py` to filter out `None` values when compiling the list of unique `faculty_names` and when assigning `faculty_id`.
3. Update tests in `backend/tests/test_parser.py` to cover the new 2-line cell format and verify it returns `None` for faculty.
