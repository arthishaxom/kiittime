# 02 - Backend: Overwrite Roll Number Mappings on Edit

**What to build:** Modify the backend OTP verification logic so that it implements a Slowly Changing Dimension (SCD) Type 1 data retention strategy. When a student verifies an OTP to link a new set of sections to their roll number, the backend should delete all existing section mappings for that roll number (across all academic years) before inserting the new ones.

**Why:** Currently, when a user edits their sections via the OTP flow, the new sections are added but the old sections remain in the `RollNumberMapping` table. This causes the client to load both the new and old timetables when the user re-enters their roll number.

**Blocked by:** 01 — UI: Edit Button (Not strictly blocked, but sequential in logic)

## Tasks
- [x] In `backend/src/backend/api/routers/otp.py`, inside the `verify_otp` endpoint, add a SQL `delete` statement before the loop that inserts the new mappings.
- [x] The delete statement should target `RollNumberMapping` where `RollNumberMapping.roll_no == roll_no`.
- [x] Ensure this deletion happens inside the same database transaction before `db.commit()` is called.
