# 04 — webapp: fetch, dismissal tracking, modal, dot badge

**What to build:** The student-facing side on `webapp`: fetch the current announcement, persist a `lastSeenAnnouncementId`, and surface it as an auto-shown modal on open, a dot on the settings-gear icon, and a permanent "Announcement" entry in the settings sheet.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] `webapp/src/lib/api.ts` gains an `Announcement` type and `fetchCurrentAnnouncement()` calling `GET /announcements/current`, returning `null` when none is active
- [x] `webapp/src/lib/storage.ts` gains `getLastSeenAnnouncementId()`/`setLastSeenAnnouncementId(id)` over `localStorage` (key `kiit-time:last-seen-announcement`), following the existing round-trip shape
- [x] `webapp/src/lib/announcements.ts` exports the pure `isAnnouncementUnseen(currentId, lastSeenId)` — `currentId === null` → `false`, otherwise `currentId !== lastSeenId`
- [x] Unit tests added: `lib/__tests__/announcements.test.ts` (4 cases) and `lib/__tests__/storage.test.ts` (round-trip + malformed-data fallback for both the existing section-ids storage and the new announcement-id storage) — **this is the first test file in `webapp`**, so `vite.config.ts` gained `test: { environment: 'jsdom' }` (the `jsdom` devDependency already existed but wasn't wired up; without it, `localStorage` isn't defined in the default Node test environment). All 10 tests pass (`pnpm run test`).
- [x] `webapp/src/hooks/useAnnouncement.ts` wraps `fetchCurrentAnnouncement` in TanStack Query, key `['announcement/current']`, `staleTime: 0`
- [x] `webapp/src/components/AnnouncementDialog.tsx` (built the same way as `AboutDialog`) shows title, body, and a tappable link when present; auto-opens via a `useEffect` keyed on `announcement?.id` (intentionally not the whole object — it changes identity every `staleTime: 0` refetch) when unseen
- **Amended during ticket 05 (mobile) testing**: dismissing via close/tap-outside no longer marks the announcement seen — a user could accidentally tap outside and permanently lose the notification without reading it. Added an explicit "Mark as read" button inside the dialog; only that calls `setLastSeenAnnouncementId`. `onOpenChange` now only controls visibility.
- [x] The settings-gear trigger shows a dot badge (`bg-brand`, top-right of the button) when `isAnnouncementUnseen` is true, clearing via the same re-derivation once dismissed
- [x] The settings sheet gains an "Announcement" entry, rendered only when an announcement exists (nothing to reopen otherwise), reopening the same dialog regardless of seen state — **deviation from spec**: marks it seen on *close*, not on *open* like the ticket originally said; since the only way to leave the dialog open is to close it (which always marks it seen via the shared `onOpenChange` handler), the end state is identical, just marked slightly later
- [x] Manual verification — confirmed working. Caught and fixed a regression during testing: the dot badge's `relative` class on the FAB conflicted with its existing `fixed` class (both set CSS `position`; Tailwind's generated stylesheet order, not `className` order, decided which won), which broke the FAB's fixed positioning. Removed `relative` — `position: fixed` already establishes a containing block for the absolutely-positioned dot, so it wasn't needed.
