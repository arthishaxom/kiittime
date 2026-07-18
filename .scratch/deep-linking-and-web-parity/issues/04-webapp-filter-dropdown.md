# 04 — Webapp Section Filter Dropdown Parity

**What to build:** Replace the horizontal badge-based prefix selection bar in the Webapp's `SectionSearch` component with a standard `Select` dropdown component, matching the design and layout of the mobile app's section filter dropdown.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Import and use the UI `Select` component in `webapp/src/components/SectionSearch.tsx`.
- [x] Replace the horizontal badges list (`{prefixes.length > 1 && ...}`) with the new `<Select>` dropdown for prefixes.
- [x] Ensure that selecting a prefix from the dropdown filters the available sections identically to the current logic.
- [x] Maintain consistent styling matching the design aesthetics of the rest of the webapp.
- [x] Write/update tests to cover the dropdown functionality and verify parity.
