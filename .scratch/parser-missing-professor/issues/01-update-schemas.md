# 01-update-schemas

Status: resolved
Type: task

## Context
We need to allow `NULL` faculty names and IDs in the backend pipeline schemas.

## Requirements
1. Update `backend/src/backend/pipeline/schemas.py`: Change `SessionRow.faculty_name` to `str | None`.
2. Update `backend/src/backend/pipeline/resolve.py`: Change `ResolvedSession.faculty_id` to `int | None`.
3. Update `backend/src/backend/db/models.py`: Change `ClassSession.faculty_id` to `Mapped[int | None]` (nullable foreign key).
4. Run `alembic revision --autogenerate -m "Make faculty_id nullable"` to generate the database migration file.
