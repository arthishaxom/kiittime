# 02 — Standardize Webapp Share Link Format

**What to build:** Ensure standard formatting and parsing of share links on the web platform. The webapp must be updated to successfully parse single section IDs (e.g., `?section_id=1`) from mobile share links without failing Zod validation. Furthermore, sharing a timetable from the webapp must manually construct standard repeating query parameters (e.g., `?section_id=1&section_id=2`) based on the current window origin, ensuring deep links into the native mobile app function as intended instead of relying on default JSON array strings.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Webapp routing schema is updated to safely parse both single integers and arrays of integers.
- [x] The `shareTimetable` function constructs URLs using standard repeating query parameters.
- [x] Sharing a timetable from the webapp results in a link format identical to the mobile app (e.g. `?section_id=1&section_id=2`).
