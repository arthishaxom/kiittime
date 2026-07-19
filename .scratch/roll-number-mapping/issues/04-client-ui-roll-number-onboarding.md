# 04 — Client UI: Roll Number Onboarding (Mobile & Web)

**What to build:** An updated onboarding experience on both the mobile app and web app. Instead of manually picking sections and years, users type their Roll Number. This relies on the API to either load the timetable automatically, show a global "No timetables" error, or offer a manual fallback.

**Blocked by:** 01 — Database Schema & Roll Number Lookup API

**Status:** ready-for-agent

- [ ] Update `mobile` onboarding root to feature a Roll Number input by default.
- [ ] Update `webapp` onboarding root to feature a Roll Number input by default.
- [ ] Call `GET /api/roll-numbers/{roll_no}` on submission.
- [ ] On success, automatically fetch and display the aggregated timetable.
- [ ] On "Empty DB" error, show a blocking "No timetables uploaded yet" message.
- [ ] Demote the manual section selection UI to a secondary "Select manually" fallback button.
