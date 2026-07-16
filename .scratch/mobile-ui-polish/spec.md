Status: ready-for-agent

# Spec: Mobile UI Polish (Section Filter, Settings Sheet, About Dialog)

## Problem Statement

Three UI rough edges in the mobile app (`mobile/`), all regressions relative to the webapp's established patterns or basic usability:

1. On the section-selection screen, the department/prefix filter is a row of small `Badge` chips in a horizontal `ScrollView`. The touch targets are too small, the selected chip has weak visual contrast (easy to miss which one is active), and when there are enough prefixes to overflow the row there's no indication that more content is scrollable — chips just get cut off at the screen edge.
2. In the Settings bottom sheet, all four actions (Share, Reset, Contact, About) render as identical full-width rows. The webapp pairs Share and Reset side-by-side and styles Reset with a destructive (red) color, since it's a data-clearing action — the mobile version gives Reset no visual warning and no relationship to Share.
3. The About dialog renders as a visibly narrow, cramped card rather than using the available screen width, because the outer overlay padding and the dialog card's own content padding compound.

## Solution

1. Replace the section-prefix chip row (`mobile/src/app/select/sections.tsx`) with a single dropdown/select control, built on the existing (currently unused) `mobile/src/components/ui/select.tsx` primitives. A dropdown removes the overflow/scroll-indicator problem entirely regardless of how many prefixes exist, and always shows the one active selection clearly.
2. Extract the prefix-extraction and filtering logic out of the component's inline `useMemo`s into a pure, unit-tested lib module, following the existing pattern in `mobile/src/lib/__tests__/`.
3. Restyle the Settings sheet (`mobile/src/components/settings-sheet.tsx`) to mirror the webapp's `webapp/src/routes/timetable.tsx` layout: Share and Reset become a two-up row (`flex-1` each), Reset uses the destructive/danger color token, Contact and About remain full-width rows below in the same order.
4. Reduce the About dialog's (`mobile/src/components/about-dialog.tsx`, and/or the shared `mobile/src/components/ui/dialog.tsx` primitives if the padding lives there) outer overlay margin and inner content padding so the card visibly spans close to full screen width instead of reading as a small floating box.

## User Stories

1. As a mobile user browsing sections, I want to pick my department/prefix from a dropdown instead of hunting through small chips, so that I can filter quickly regardless of how many departments exist.
2. As a mobile user, I want the dropdown to clearly show which prefix is currently selected, so that I always know what filter is active.
3. As a mobile user with a school that has many departments, I want the filter control to never overflow or hide options without indication, so that I'm never unsure whether more choices exist.
4. As a mobile user searching by text, I want text search and the prefix dropdown to keep working together exactly as before, so that narrowing by both stays possible.
5. As a mobile user opening Settings, I want Share and Reset presented side-by-side like on the web app, so that the two most common actions are easy to reach together.
6. As a mobile user, I want the Reset button to look destructive (e.g. red), so that I don't tap it by accident and understand it clears my saved sections.
7. As a mobile user, I want Contact and About to remain clearly separated as full-width secondary actions, so that the sheet's visual hierarchy matches the webapp.
8. As a mobile user opening the About dialog, I want it to use the full available screen width like other dialogs/sheets in the app, so that it doesn't look cramped or broken.
9. As a developer, I want the prefix-extraction and filtering logic covered by unit tests in `mobile/src/lib`, so that future changes to section filtering don't silently break.

## Implementation Decisions

- **Section filter UI** (`mobile/src/app/select/sections.tsx`):
  - Remove the horizontal `ScrollView` of `Badge` chips.
  - Add a `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` (from `mobile/src/components/ui/select.tsx`) bound to `selectedPrefix`, with `"All"` as the default/first option.
  - Keep the existing behavior: selecting a prefix filters `sections` in combination with the text `search` input; selecting "All" clears the prefix filter.
- **Prefix/filter logic extraction**:
  - New pure module under `mobile/src/lib` (e.g. `sections.ts`) exporting:
    - A function that extracts unique, sorted, uppercased alphabetic prefixes from a list of section names (same regex behavior as today: `/^[A-Z]+/i`), prepending `"All"`.
    - A function that filters+sorts a section list by free-text search and selected prefix (same alphanumeric `localeCompare` sort as today).
  - `sections.tsx` calls these functions from its `useMemo`s instead of inlining the logic.
  - No change to the resulting filtering/sorting *behavior* — this is a refactor for testability, not a behavior change.
- **Settings sheet** (`mobile/src/components/settings-sheet.tsx`):
  - Wrap the Share and Reset `Pressable`s in a `flex-row` container with `gap`, each given `flex-1`, matching webapp's paired layout.
  - Apply the danger/destructive color token (matching webapp's `bg-danger/90`) to the Reset button's background.
  - Contact and About remain unchanged full-width rows below the paired row, same order as today.
- **About dialog width** (`mobile/src/components/about-dialog.tsx` / `mobile/src/components/ui/dialog.tsx`):
  - Reduce the `DialogOverlay`'s outer padding and/or the `DialogContent`'s content padding (currently `p-2` on the overlay, `p-6` on the content) enough that the About card visibly spans close to full device width.
  - Since `DialogContent` is a shared primitive, check whether other dialog usages in the app exist before changing shared padding; if other dialogs depend on the current padding, apply the width fix at the `about-dialog.tsx` call site instead (e.g. an override className) rather than changing the shared primitive.

## Testing Decisions

- Only test external behavior (inputs/outputs of pure functions), not implementation details — matches the existing philosophy used across `mobile/src/lib/__tests__/`.
- **New tests**: `mobile/src/lib/__tests__/sections.test.ts` (or similarly named) covering the new prefix-extraction and filter/sort functions: unique prefix extraction from mixed-case section names, "All" always present and first, filtering by prefix, filtering by search text, combined prefix+search filtering, alphanumeric sort ordering (e.g. `CS1, CS2, CS10`).
- **Prior art**: `mobile/src/lib/__tests__/timetable.test.ts` and `mobile/src/lib/__tests__/storage.test.ts` for the pure-function unit test style used in this codebase.
- **Settings sheet / About dialog changes**: styling/layout-only, no new logic — verified by manual visual QA (run the app via `pnpm expo`, open Settings sheet and About dialog, confirm against webapp reference layout), not automated tests.

## Out of Scope

- Any change to the webapp (`feature/webapp` branch) or admin-webapp — this spec only touches the `mobile/` app.
- Changing what data appears in Settings or About, or adding/removing actions.
- Changing the underlying section-selection data model, API, or the `MAX_SECTIONS` selection cap logic.
- Any change to section sorting/filtering *behavior* — the refactor to `mobile/src/lib` must preserve existing output exactly.

## Further Notes

- The `Select` primitives in `mobile/src/components/ui/select.tsx` already exist in the codebase (built on `@rn-primitives/select`) but are currently unused anywhere — this is their first real usage.
- Reference implementation for both the sheet layout and the About dialog content lives on the `feature/webapp` branch: `webapp/src/routes/timetable.tsx` (Settings sheet) and `webapp/src/components/AboutDialog.tsx`.
