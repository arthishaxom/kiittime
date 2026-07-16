# 04 — Timetable shell (tap-based day tabs, no drag yet)

**What to build:** The core timetable view. A student sees their merged schedule grouped by day, with tap-to-switch day tabs defaulting to today, and a clear empty state for days with no classes. (Swipe/drag interaction is a separate ticket — tabs are tap-only for now.)

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `/timetable?section_id=...` parses the section_id param (via the shared helper from ticket 03) and fetches via `useTimetable(sectionIds)`
- [x] Sessions are grouped by day (Mon–Sat) and sorted by period number via a new `groupSessionsByDay`/`DAYS` helper in a shared, testable module; tests cover grouping/sort correctness including an empty-sessions case
- [x] A day-tab strip (Mon..Sat) renders with the current day selected by default (today, Mon=0..Sat=5 remap, Sunday folds to index 5)
- [x] Tapping a day tab switches the visible panel to that day (no animation/gesture requirement yet — that's ticket 05)
- [x] Each session renders as a card showing course code, room number, and `formatTime(start_time)`
- [x] A day with zero sessions shows a "No Classes Today" message
- [x] A failed fetch (`useTimetable` error) shows plain error text, no retry button
- [x] Verifiable end-to-end: selecting sections in ticket 03 and landing here shows the correct merged, grouped schedule; tapping each day tab shows that day's sessions; an empty day shows the empty state
