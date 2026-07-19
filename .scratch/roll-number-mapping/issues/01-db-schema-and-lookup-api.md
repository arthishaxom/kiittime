# 01 — Database Schema & Roll Number Lookup API

**What to build:** The foundational database layer and lookup API. It enables querying a roll number to retrieve the user's mapped sections, returning an empty state error if the entire database has no timetables for the semester, or a "not found" error if just that roll number is missing.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Create `RollNumberMapping` model in `backend/src/backend/db/models.py`.
- [x] Generate and apply Alembic migration for the new schema.
- [x] Implement `GET /api/roll-numbers/{roll_no}` endpoint.
- [x] Endpoint checks if there are ANY sections in the DB to distinguish global empty state vs missing mapping.
- [x] Add backend tests for the endpoint validating all 3 states (Success, Empty DB, Not Found).

