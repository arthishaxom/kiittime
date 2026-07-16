# 01 — Fix Admin Upload Scope (Replace Department with Year)

**What to build:** Replaces the unimplemented "department" scoping with a functional "year" scope in the backend pipeline and admin UI, allowing admins to safely overwrite a specific academic year's timetable.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Admin UI upload review screen captures `year` instead of `department` when doing scoped replacement.
- [ ] Backend `UpsertScope` uses `year` instead of `department`.
- [ ] Gold pipeline queries the database to match sections by `year` instead of `department` for correct subset deletion.
- [ ] Verify functionality via backend tests (e.g., `test_gold.py`).
