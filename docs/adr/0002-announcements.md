# 2. Announcements

Date: 2026-07-16

## Status

Accepted

## Context

Students have no in-app way to learn about time-sensitive, admin-authored notices (e.g. "Semester 2 timetable is live," "report bugs here"). The system has no login/signup for students, so any solution must work anonymously, keyed only to the device/browser. Push notifications are a real option even without accounts (Expo push tokens on mobile, Web Push subscriptions on the webapp's existing service worker) but require new backend infra (token storage, a send pipeline, permission-prompt UX) and are deliberately **out of scope for this decision** — parked as a future ADR.

## Decision

We are introducing a single, admin-authored **Announcement**, surfaced identically on `webapp` and `mobile`:

- **Single active announcement**: at most one announcement is active at a time. No feed/inbox.
- **Immutable rows**: publishing creates a new `announcements` row (`title`, `body`, optional `link_label`/`link_url`, `created_at`, `is_active`). There is no edit-in-place endpoint — fixing a mistake means clearing the bad row (`is_active = false`) and publishing a corrected new one.
- **Single-active invariant enforced at write time**: creating a new announcement is a transaction that sets `is_active = false` on all other rows before inserting the new row as the sole active one. "Current announcement" query: `WHERE is_active ORDER BY created_at DESC LIMIT 1`.
- **Admin can clear without replacing**: `is_active` can be toggled off independently, so a stale/mistaken announcement can be turned off with no replacement content.
- **Content limits**: title ≤ 80 chars, body ≤ 500 chars (plain text, no markdown), link label ≤ 30 chars — enforced both in the admin-webapp form and via Pydantic `Field(max_length=...)` on the backend schema.
- **Client tracking**: each client persists a single `lastSeenAnnouncementId` (webapp `localStorage`, mobile `AsyncStorage`, same pattern as existing `kiit-time:selected-sections`). `isUnseen = currentAnnouncement.id !== lastSeenAnnouncementId` is the single source of truth for three render sites:
  1. Auto-shown blocking modal on app open, when `isUnseen`.
  2. A dot badge on the settings-sheet gear icon, when `isUnseen`.
  3. A permanent "Announcement" entry in the settings sheet, always tappable regardless of `isUnseen` — the recoverability safety net.
  Dismissing (any close method: X, tap-outside, or reopening from settings) sets `lastSeenAnnouncementId = currentAnnouncement.id`, clearing both the modal-on-open and the dot simultaneously.
- **Fetch policy**: query key `['announcement', 'current']`, `staleTime: 0`, refetched on every app mount/foreground, persisted through the existing TanStack Query persister as an offline fallback (last-known announcement renders if the device is offline; new announcements are only discovered once back online and the app is reopened, since push is out of scope).
- **API shape**: public `GET /announcements/current` (no auth, mirrors `sections`/`timetable` routers); admin endpoints under the existing `/admin` prefix (`POST /admin/announcements` to create — which also deactivates prior rows — and a clear/deactivate action), gated by the existing `get_current_admin` dependency, matching `admin.py`'s current pattern.

## Consequences

- No push notifications yet — discovery is opportunistic (only on app open), which is an accepted tradeoff pending a future push-notification ADR.
- Announcement history is retained (immutable rows), giving a free audit log of past notices with no extra modeling cost.
- The "single active announcement" constraint means this cannot yet express multiple concurrent notices (e.g. a maintenance notice and a feature announcement at once) — would require revisiting decision 1 if that need arises.
- New backend surface: `announcements` table + migration, one public GET endpoint, two admin endpoints, extending the existing `/admin` auth pattern.
- New admin-webapp surface: a form (title, body, optional link) and a clear action, likely reusing existing form/dialog primitives already in `admin-webapp/src`.
- New client surface on both `webapp` and `mobile`: an announcement modal (mobile: a `dialog.tsx`-based dialog matching the existing About dialog's construction), a settings-sheet dot badge, and a settings-sheet entry point — plus one new persisted key (`lastSeenAnnouncementId`) per client.
