Status: resolved

# Implement web storage constants and reset logic

In `webapp/src/lib/storage.ts` (equivalent storage file):
- [x] Define constants for `ACTIVE_ROLL_NO_KEY` and `ACTIVE_ACADEMIC_YEAR_KEY`.

In `webapp/src/routes/timetable.tsx`:
- [x] Replace raw string `"kiit-time:active-roll-no"` and `"kiit-time:active-academic-year"` with constants.
- [x] Update `handleReset` to call `localStorage.removeItem()` for both keys.
