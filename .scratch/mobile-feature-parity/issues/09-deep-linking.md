# 09 — Deep linking verification

**What to build:** Confirm that `kiittime://timetable?section_id=...` deep links resolve directly to the timetable screen via expo-router's default file-based linking, so future features (QR codes, notifications) have a working link target to build on.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] `kiittime://timetable?section_id=1` (and multi-id variants) opens the app directly to `/timetable` with the correct sections loaded, using expo-router's existing `kiittime` scheme (already declared in `app.config.js`) — no custom linking config expected to be needed, but add one if the default doesn't resolve correctly
- [x] Verified via `npx uri-scheme open kiittime://timetable?section_id=1 --ios` (and the Android `adb` equivalent) against a built dev client
- [x] The scheme/URL shape is documented (e.g. in the relevant lib/README comment) for future producers — no producer of these links is built in this ticket
- [x] Verifiable end-to-end: the `uri-scheme`/`adb` command opens the app straight to the correct timetable, with no other producer wired up yet
