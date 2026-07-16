# 03 — About dialog: full-width layout fix

**What to build:** The mobile About dialog visibly spans close to full device width instead of reading as a small, cramped floating card. This means trimming the compounding outer overlay padding and inner content padding on the dialog. If the padding lives in the shared dialog primitive (`mobile/src/components/ui/dialog.tsx`) rather than the About dialog itself, check for other dialog usages first — if any exist and depend on the current padding, apply the width fix as an override at the About dialog's call site instead of changing the shared primitive.

**Blocked by:** None — can start immediately

- [ ] The About dialog card visibly spans close to full screen width on a typical phone viewport, not a narrow centered box
- [ ] No other dialog usage in the app (if any exists) regresses in width/padding as a side effect
- [ ] Dialog content (logo, version, links, license text) remains legible and properly spaced, not edge-to-edge cramped either
- [ ] Verified by manual run via `pnpm expo`: open About and compare against the webapp's `AboutDialog` reference for proportions
