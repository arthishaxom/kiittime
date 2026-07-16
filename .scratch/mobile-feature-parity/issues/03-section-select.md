# 03 — Section search, multi-select (capped at 5), persistence

**What to build:** The section-selection screen. A student searches their year's sections by name, multi-selects up to 5, sees their picks as removable chips, and confirms to persist the selection and move on to the timetable.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] `/select/sections?year=N` fetches sections via `useSections(year)`
- [x] A search input filters the list by case-insensitive substring match on section name
- [x] Sections render as tappable rows supporting multi-select (custom `Pressable` rows, not `toggle-group`)
- [x] Selected sections appear as removable chips with a live count; tapping a chip deselects it
- [x] Selection is capped at 5: once 5 are selected, unselected rows visually disable and an inline "Max 5 sections" message appears near the chips row; already-selected rows remain tappable to deselect
- [x] "Done" is disabled until at least 1 section is selected
- [x] Tapping "Done" calls `saveSectionIds` then navigates to `/timetable?section_id=...` with the selected ids
- [x] Empty state (year has zero sections) and no-match state (search matches nothing) each show a distinct message with a mailto link (`Linking.openURL(buildMailto(...))`) to request the section be added
- [x] A shared helper normalizes the `section_id` search param (string | string[] | undefined → `number[]`, catch-to-`[]`) for reuse by tickets 02/04/09; this ticket introduces it and adds tests for it
- [x] Verifiable end-to-end: search narrows the list correctly, selection/cap/chip-removal all behave as specified, and completing selection lands on `/timetable` with persisted ids surviving app relaunch
