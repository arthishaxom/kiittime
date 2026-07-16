# 01 — Fix Admin Upload Scope (Replace Department with Year)

**What to build:** Replaces the unimplemented "department" scoping with a functional "year" scope in the backend pipeline and admin UI, allowing admins to safely overwrite a specific academic year's timetable.

**Blocked by:** None — can start immediately.

**Status:** closed

- [x] Admin UI upload review screen captures `year` instead of `department` when doing scoped replacement.
- [x] Backend `UpsertScope` uses `year` instead of `department`.
- [x] Gold pipeline queries the database to match sections by `year` instead of `department` for correct subset deletion.
- [x] Verify functionality via backend tests (e.g., `test_gold.py`).

## Comments

Implemented: `scope.py`/`gold.py` now use `Section.year` (a real column) instead of the forward-looking `department` stub; added `test_year_scope_only_deletes_that_year` and `test_year_scope_violation_raises_and_no_db_change` to `test_gold.py` (8/8 pass via `uv run pytest`). `admin-webapp/.../review.$uploadId.tsx` scope mode is now "By year" with a numeric Year input, `buildScopeBody` sends `{ section_ids, year }`.
