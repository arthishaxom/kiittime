# 01 — Section prefix filter: dropdown + tested filter logic

**What to build:** On the mobile section-selection screen, replace the horizontal-scrolling `Badge` chip row (used to filter sections by department/prefix) with a single dropdown control, built on the existing (currently unused) `Select` primitives in `mobile/src/components/ui/select.tsx`. The prefix-extraction and search+prefix filtering/sorting logic that currently lives inline in the screen's `useMemo`s moves into a pure, unit-tested module under `mobile/src/lib`, and the screen calls those functions instead of inlining the logic. Filtering/sorting behavior must stay identical to today (same regex-based prefix extraction, same alphanumeric sort, same combined search+prefix filtering) — only the presentation changes from chips to a dropdown, plus the logic becomes testable.

**Blocked by:** None — can start immediately

- [ ] A new `mobile/src/lib` module exports a pure function that extracts unique, sorted, uppercased alphabetic prefixes from a list of section names (same `/^[A-Z]+/i` behavior as today), with `"All"` prepended
- [ ] The same module exports a pure function that filters+sorts a section list by free-text search and selected prefix, using the same alphanumeric (`localeCompare`, numeric) sort as today
- [ ] Unit tests cover: unique prefix extraction from mixed-case names, `"All"` always present and first, filtering by prefix only, filtering by search only, combined prefix+search filtering, and alphanumeric sort ordering (e.g. `CS1, CS2, CS10`) — following the pure-function test style already used in `mobile/src/lib/__tests__/`
- [ ] `mobile/src/app/select/sections.tsx` renders a `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` dropdown bound to the selected prefix (default `"All"`) instead of the `Badge` chip `ScrollView`
- [ ] The screen's prefix/filter `useMemo`s call the new lib functions instead of containing the logic inline
- [ ] Selecting a prefix and typing a search term still narrow the section list together, exactly as before
- [ ] With many prefixes (more than would have overflowed the old chip row), the dropdown shows all options with no overflow or visibility issue — verified by manual run via `pnpm expo`
