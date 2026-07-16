# 02 — Settings sheet: pair Share/Reset, make Reset destructive

**What to build:** In the mobile Settings bottom sheet, Share and Reset render side-by-side in one row (each taking equal width), matching the webapp's `webapp/src/routes/timetable.tsx` layout. Reset is styled with the app's danger/destructive color token (matching webapp's `bg-danger/90`), since it clears the user's saved sections. Contact and About stay as full-width rows below, in their current order, unchanged.

**Blocked by:** None — can start immediately

- [ ] Share and Reset appear in a single row, each filling half the available width
- [ ] Reset uses the danger/destructive background color instead of the neutral surface color used by the other actions
- [ ] Contact and About remain full-width rows below the paired row, in the same order as today
- [ ] Reset still clears saved sections and navigates home exactly as before — only the visual presentation changes
- [ ] Verified by manual run via `pnpm expo`: open the Settings sheet and compare against the webapp reference layout
