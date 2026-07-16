# 06 — Settings sheet shell: Reset + Contact

**What to build:** A floating settings entry point on the timetable screen that opens a native bottom sheet with Reset and Contact actions.

**Blocked by:** 04, 01

**Status:** ready-for-agent

- [x] A floating gear FAB on the timetable screen opens a `@gorhom/bottom-sheet` `BottomSheetModal` via a ref
- [x] Sheet uses `enableDynamicSizing` (content-sized, no fixed snap points) and a `BottomSheetBackdrop` (`disappearsOnIndex={-1}`, `appearsOnIndex={0}`, `pressBehavior="close"`)
- [x] Sheet chrome (`backgroundStyle`/`handleIndicatorStyle`) uses the `sheet` token (`#181818`), not `surface`
- [x] "Reset" row: single immediate tap (no confirmation), calls `clearSavedSectionIds()` AND `queryClient.clear()`, then navigates back to `/`
- [x] "Contact" row: `Linking.openURL(buildMailto(...))`; `buildMailto` is a new pure helper ported from the webapp, with tests covering subject/body-string construction
- [x] Verifiable end-to-end: gear FAB opens the sheet sized to its content with the correct background; Reset clears storage+cache and returns to the year picker (confirm re-selecting doesn't reuse stale cached data); Contact opens the mail composer with the expected prefilled subject
