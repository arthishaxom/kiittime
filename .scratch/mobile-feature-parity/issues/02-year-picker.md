# 02 — Year picker + returning-user fast path

**What to build:** The app's entry screen. A student picks their year (1–4) and proceeds to section selection — or, if they've already selected sections in a prior session, the app skips straight to their timetable with no flash of the picker.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `/` screen renders a year picker (buttons 1–4), local selection state, and a "Select sections" action
- [x] "Select sections" is disabled until a year is chosen
- [x] Choosing a year and tapping "Select sections" navigates to `/select/sections?year=N`
- [x] On mount, the native splash screen is held (`SplashScreen.preventAutoHideAsync()`) while `getSavedSectionIds()` is checked
- [x] If saved section ids exist, the app redirects straight to `/timetable?section_id=...` (splash hidden only after this check resolves) — no visible flash of the year picker
- [x] If no saved sections exist, the year picker renders normally after the splash is hidden
- [x] An About entry point exists on this screen (wiring to the actual About dialog lands in ticket 08 — for now this can be a no-op or stub trigger)
- [x] Verifiable end-to-end: fresh install lands on the year picker; after ticket 03 exists, completing selection once and relaunching the app skips straight to the timetable
