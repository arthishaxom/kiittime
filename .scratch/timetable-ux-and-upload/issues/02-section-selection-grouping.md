# 02 — Dynamic Grouping and Sorting for Section Selection (Mobile & Webapp)

**What to build:** Upgrades the section selection screens. It extracts section prefixes dynamically to create horizontal filter chips (e.g., `[CS]`, `[IT]`) that users can tap to narrow the list. It also applies alphanumeric sorting to the resulting list for better UX.

**Blocked by:** None — can start immediately.

**Status:** closed

- [x] Extract unique alphabetical prefixes from the available sections list (e.g., "CS1" -> "CS").
- [x] Render horizontal, selectable filter chips for the extracted prefixes (including an "All" default).
- [x] Filter the section list based on the currently active chip AND the text search query.
- [x] Sort the filtered sections alphanumerically before rendering.
- [x] Implement these changes consistently in both `mobile` and `webapp` section selection screens.

## Comments

Implemented in both `mobile/src/app/select/sections.tsx` and `webapp/src/routes/select/sections.tsx`: prefixes extracted via `/^[A-Z]+/i`, rendered as a horizontal scrollable row of `Badge`s (`selectedPrefix` state, "All" default), filtered list combines search text + active chip, sorted via `localeCompare(..., { numeric: true })`. Mobile Jest suite (31 tests) and both apps' `tsc --noEmit` pass with no new errors.
