# 05 — Draggable day-tab carousel (gesture/spring/elastic/snap)

**What to build:** Upgrade the tap-only day tabs from ticket 04 into the full gesture-driven carousel: swiping between days with spring-animated transitions, elastic resistance at the week boundaries, and a snap-to-nearest-day threshold — matching the webapp's `motion`-based carousel feel using Reanimated + Gesture Handler.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Day panels are driven by a Reanimated shared value (`translateX`); `activeIndex` is mirrored as both React state (tab-strip highlight) and a shared value (gesture-thread reads)
- [x] `goTo(index)` clamps to valid range and animates via `withSpring(-index * containerWidth, { damping: 40, stiffness: 400 })`
- [x] A `Gesture.Pan()` gesture is attached to the panel row: `.activeOffsetX([-10, 10])` so vertical scrolling inside a day panel isn't hijacked by the horizontal pan
- [x] Dragging past the first (Mon) or last (Sat) day shows elastic resistance (~0.15 dampening factor), not a hard stop or overshoot
- [x] Releasing a drag under the snap threshold (20% of container width) springs back to the current day; releasing past it advances/retreats one day and updates tab-strip highlighting in sync
- [x] `containerWidth` is measured via `onLayout` (no hardcoded widths)
- [x] Tapping a tab still works and animates via the same `goTo` path as ticket 04
- [x] Verifiable end-to-end (manual — gesture/animation has no automated test seam per the spec): swipe in both directions, boundary drags, small/large swipe distances, and diagonal drags inside a busy day panel all behave as specified
