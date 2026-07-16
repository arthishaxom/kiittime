# 10 — Fix SafeAreaView Jitter

**What to build:** Refactor the app screens to stop using `SafeAreaView` directly, as it causes layout jitter when the app state changes. Instead, read the insets via `useSafeAreaInsets` and apply them as padding to a standard `View`.

**Blocked by:** none

**Status:** closed

- [x] In `mobile/src/app/index.tsx`, remove `SafeAreaView` and replace it with a `<View>` padded by `useSafeAreaInsets().top`.
- [x] In `mobile/src/app/select/sections.tsx`, remove `SafeAreaView` and replace it with a `<View>` padded by `useSafeAreaInsets().top`.
- [x] In `mobile/src/app/timetable.tsx`, remove `SafeAreaView` and replace it with a `<View>` padded by `useSafeAreaInsets().top` (and bottom if necessary).
- [x] Ensure that state updates (like selecting a year, or swiping days) no longer cause visual layout jitter.

## Comments

Verified against the codebase (2026-07-16): `index.tsx`, `select/sections.tsx`, and `timetable.tsx` already use `useSafeAreaInsets()` with manual padding and contain no `SafeAreaView` import. Implemented as part of the mobile-feature-parity work; closing without further changes.
