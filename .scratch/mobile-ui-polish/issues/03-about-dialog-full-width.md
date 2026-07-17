# 03 — About dialog: full-width layout fix

**What to build:** The mobile About dialog visibly spans close to full device width instead of reading as a small, cramped floating card. This means trimming the compounding outer overlay padding and inner content padding on the dialog. If the padding lives in the shared dialog primitive (`mobile/src/components/ui/dialog.tsx`) rather than the About dialog itself, check for other dialog usages first — if any exist and depend on the current padding, apply the width fix as an override at the About dialog's call site instead of changing the shared primitive.

**Blocked by:** None — can start immediately

<<<<<<< HEAD
<<<<<<< HEAD
- [x] The About dialog card visibly spans close to full screen width on a typical phone viewport, not a narrow centered box — fixed at the shared primitive (`mobile/src/components/ui/dialog.tsx`), not with a per-call-site override. Root cause was deeper than the original `pr-15`/`pl-15` attempt (which was a no-op — `15` isn't a valid Tailwind spacing step in this project, so that class did nothing): the two `NativeOnlyAnimatedView` wrappers inside `DialogOverlay` had no width styling at all, so they shrank to their content's size, and `DialogContent`'s `w-full` then resolved against that undetermined-width parent instead of the actual screen — meaning short-content dialogs (like the new Announcement dialog, ticket `announcements/05`) visibly shrank while longer ones looked closer to full width by coincidence. Fixed by giving both wrapper views `w-full items-center` so the percentage-width chain has something real to resolve against, and changed the overlay's outer padding from `p-1` to `px-4` to create a deliberate ~16px screen-edge margin.
- [x] No other dialog usage regressed — `about-dialog.tsx`'s broken `pr-15 pl-15` override removed (no longer needed now that the primitive itself is fixed); `announcement-dialog.tsx` (built after this ticket, during `announcements/05`) uses the same primitive with no per-call-site override and is unaffected.
- [x] Dialog content remains legible and properly spaced — internal `p-6` card padding (between border and content) is untouched; only the outer screen-edge margin and width-resolution chain changed.
- [ ] Verified by manual run via `pnpm expo` — not yet done in this session; please confirm both About and Announcement dialogs now look correctly full-width-with-margin.
=======
=======
>>>>>>> origin/main
- [ ] The About dialog card visibly spans close to full screen width on a typical phone viewport, not a narrow centered box
- [ ] No other dialog usage in the app (if any exists) regresses in width/padding as a side effect
- [ ] Dialog content (logo, version, links, license text) remains legible and properly spaced, not edge-to-edge cramped either
- [ ] Verified by manual run via `pnpm expo`: open About and compare against the webapp's `AboutDialog` reference for proportions
<<<<<<< HEAD
>>>>>>> origin/dev
=======
>>>>>>> origin/main
