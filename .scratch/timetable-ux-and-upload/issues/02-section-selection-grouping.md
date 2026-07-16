# 02 — Dynamic Grouping and Sorting for Section Selection (Mobile & Webapp)

**What to build:** Upgrades the section selection screens. It extracts section prefixes dynamically to create horizontal filter chips (e.g., `[CS]`, `[IT]`) that users can tap to narrow the list. It also applies alphanumeric sorting to the resulting list for better UX.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Extract unique alphabetical prefixes from the available sections list (e.g., "CS1" -> "CS").
- [ ] Render horizontal, selectable filter chips for the extracted prefixes (including an "All" default).
- [ ] Filter the section list based on the currently active chip AND the text search query.
- [ ] Sort the filtered sections alphanumerically before rendering.
- [ ] Implement these changes consistently in both `mobile` and `webapp` section selection screens.
