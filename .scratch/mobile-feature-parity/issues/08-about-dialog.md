# 08 — About dialog

**What to build:** An About screen showing app version, author/GitHub links, and license, reachable both from the year-picker screen and from the settings sheet — and able to be open at the same time as the settings sheet.

**Blocked by:** 02, 06

**Status:** ready-for-agent

- [x] `about-dialog.tsx` built on the existing `dialog.tsx` primitives (`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`)
- [x] Content ported verbatim from the webapp's `AboutDialog`: version via `Constants.expoConfig?.version`, author/GitHub links via `Linking.openURL`, license text
- [x] Reuses `logo-no-bg.png`/`logo-with-bg.png` from `mobile/assets/images/` — no new assets
- [x] The year-picker screen's About trigger (stubbed in ticket 02) now opens this dialog
- [x] The settings sheet's About row (stubbed in ticket 06 as part of `onAboutPress`) now opens this dialog
- [x] Tapping About from within the settings sheet does NOT dismiss the sheet first — both the sheet and the About dialog are visible simultaneously (dialog on top)
- [x] Verifiable end-to-end: About opens correctly from both entry points, shows the correct version/links/license, and opening it from the settings sheet leaves the sheet visible underneath
