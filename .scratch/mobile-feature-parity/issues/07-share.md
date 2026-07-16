# 07 — Share action

**What to build:** A "Share" row in the settings sheet that opens the phone's native share sheet with a link to the student's timetable on the webapp.

**Blocked by:** 06

**Status:** ready-for-agent

- [x] "Share" row in the settings sheet calls a new `shareTimetable(sectionIds)` helper
- [x] The helper builds a webapp URL (`https://<webapp-domain>/timetable?section_id=...`) and calls RN's `Share.share({ message, url, title })`
- [x] Copy is verbatim from the webapp: title "My KIIT Time Timetable", message "Check out my class schedule"
- [x] Since RN's `url` share field is iOS-only, the URL is also embedded in the shared message text so Android recipients get a usable link
- [x] A thrown or cancelled share fails silently — no error surfaced to the user, no clipboard fallback
- [x] The URL-building portion of `shareTimetable` (given section ids, produces the expected URL/message text) is unit tested; the native `Share.share()` call itself is not
- [x] Verifiable end-to-end: tapping Share opens the native share sheet with the correct title/message/URL on both iOS and Android; cancelling the share sheet doesn't crash or show an error
