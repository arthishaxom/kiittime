# Announcements

**Status:** ready-for-agent

## Problem Statement

Students have no in-app way to learn about time-sensitive, admin-authored notices — a new semester's timetable going live, a request to fill out a form, a heads-up about a bug/outage. Today the only distribution channels are word of mouth or channels entirely outside the product. There is no login/signup for students, so any solution has to work anonymously, keyed only to the device/browser rather than an account.

## Solution

A single, admin-authored **Announcement** (see `CONTEXT.md` glossary, [ADR-0002](../../docs/adr/0002-announcements.md)) that the admin publishes from `admin-webapp`, and that students see automatically when opening `webapp` or `mobile` — as a blocking-but-dismissible modal on open, a persistent dot on the settings-sheet gear icon until seen, and a permanent entry in the settings sheet so it's never truly lost even after dismissal. At most one announcement is active at a time; publishing a new one is an immutable, auditable event, not an edit.

## User Stories

1. As a student opening the app (webapp or mobile) and there's an unseen active announcement, I want it to appear automatically as a modal, so that I don't have to go looking for important notices.
2. As a student who has already seen the current announcement, I want the app to open straight to my timetable with no modal interrupting me, so that returning to check my schedule stays fast.
3. As a student who dismisses the announcement modal (via close button or tapping outside), I want that dismissal to be permanent for that specific announcement, so that I'm not nagged with the same content on every subsequent app open.
4. As a student who dismissed an announcement, I want a dot badge to disappear from the settings gear icon once I've seen it, so that the badge reliably reflects whether there's something new to look at.
5. As a student who dismissed an announcement but wants to re-read it, I want a permanent "Announcement" entry in the settings sheet that reopens the current announcement regardless of dismiss state, so that closing the modal (even by accident) never permanently loses the content.
6. As a student, I want the announcement to show a title, a short body, and — when the admin included one — a tappable link/CTA, so that I can act on notices that point somewhere (a form, a schedule PDF, a bug report address).
7. As a student who is offline when a new announcement was published, I want the app to only discover it once I'm back online and reopen the app, so that I understand there's no real-time push notification behind this (out of scope, see below).
8. As an admin, I want a form in `admin-webapp` to publish a new announcement (title, body, optional link label + URL), so that I can notify students of something without touching code or the database directly.
9. As an admin, I want publishing a new announcement to automatically supersede/deactivate whatever was previously active, so that I never end up with two "active" announcements at once by mistake.
10. As an admin, I want to clear/deactivate the current announcement without publishing a replacement, so that I can retract a mistaken or stale notice immediately.
11. As an admin, I want past announcements to remain in the database as an immutable history (not edited or deleted), so that there's an audit trail of what was communicated and when.
12. As an admin, I want title/body/link length limits enforced in the publish form, so that I can't accidentally publish something that breaks the modal layout on a phone screen.
13. As an admin, I want the announcement endpoints gated behind the same admin authentication already used for uploads, so that only authorized admins can publish or clear announcements.
14. As a developer, I want the current-announcement fetch to always attempt a fresh network request on app open (`staleTime: 0`) but fall back to the last-persisted value when offline, so that the feature degrades gracefully without connectivity rather than showing nothing.

## Implementation Decisions

- **Data model**: a new `announcements` table — `id`, `title` (≤80 chars), `body` (≤500 chars, plain text, no markdown), `link_label` (≤30 chars, optional), `link_url` (optional), `is_active` (boolean, default true), `created_at`, `created_by` (admin username, mirroring `BronzeSnapshot.uploaded_by`). Rows are immutable once created — no update-in-place endpoint, only create and deactivate.
- **Single-active invariant enforced at write time**: creating a new announcement is a transaction that sets `is_active = false` on every other row before inserting the new row as the sole active one. The "current announcement" read is: most recent row where `is_active` is true, or none.
- **Backend API**: a public `GET /announcements/current` (no auth, returns the current active announcement or a null/empty response, following the existing `sections`/`timetable` router pattern of unauthenticated public reads). Two admin endpoints under the existing `/admin` prefix, gated by the existing `get_current_admin` dependency (same pattern as `admin.py`'s upload endpoints): one to create (transactionally deactivating prior rows), one to clear/deactivate the current row without replacement.
- **Content validation**: length limits (title ≤80, body ≤500, link label ≤30) enforced via Pydantic `Field(max_length=...)` on the request schema, and mirrored in the `admin-webapp` form for immediate feedback.
- **Client tracking (webapp + mobile, identical logic)**: a single persisted value, `lastSeenAnnouncementId` (webapp: `localStorage`; mobile: `AsyncStorage` — same storage layer already used for `kiit-time:selected-sections`). `isUnseen = currentAnnouncement.id !== lastSeenAnnouncementId` is the single derivation feeding three render sites: the auto-shown modal on app open, the settings-gear dot badge, and — unconditionally, regardless of `isUnseen` — the settings-sheet "Announcement" entry point. Dismissing by any method (close button, tap-outside, or reopening from settings) writes `lastSeenAnnouncementId = currentAnnouncement.id`, which clears the modal-trigger and the dot simultaneously since both are re-derivations of the same comparison, not separately tracked flags.
- **Fetch/cache policy**: query key `announcement/current`, `staleTime: 0`, refetched on every app mount/foreground via the existing TanStack Query setup on both clients, persisted through each client's existing offline persister (mobile: `PersistQueryClientProvider` + AsyncStorage persister per [ADR-0003](../../docs/adr/0003-mobile-offline-hardening.md); webapp: existing `localStorage` persister) so the last-known announcement/dismiss-relevant state survives offline app opens.
- **Modal implementation (mobile)**: built on the existing `dialog.tsx` primitives, the same construction as the existing `AboutDialog`, reached from both the auto-trigger-on-open logic and the settings sheet.
- **Push notifications are explicitly out of scope** for this spec (see below) — the fetch-on-open model is the entire delivery mechanism.

## Testing Decisions

- Good tests here exercise external behavior (inputs → outputs), matching the philosophy already established in the `mobile-feature-parity` spec's Testing Decisions.
- **Backend seam: DAO-level**, consistent with existing precedent (`tests/pipeline/*` against a real Postgres via the `db` fixture) — no `TestClient`/router-level tests exist elsewhere in this repo, so this doesn't introduce a new pattern. Cover: creating an announcement deactivates all prior active rows (transactional invariant); the "current" query returns the most recent active row or none; clearing sets `is_active = false` without creating a new row; content-length validation rejects over-limit input.
- **Client seam: the pure `src/lib/*` layer** on both `webapp` and `mobile` — a new module (or extension of `storage.ts`) holding `getLastSeenAnnouncementId`/`setLastSeenAnnouncementId` round-trip behavior (mirroring the existing `getSavedSectionIds`/`saveSectionIds` tests) and the `isUnseen` derivation as a pure function given `(currentAnnouncementId, lastSeenId)` pairs, including the "no active announcement" case.
- **Not covered by automated tests**: modal rendering, dot-badge rendering, and the settings-sheet entry point itself — verified manually, consistent with this repo's existing precedent of not automating native/UI-heavy surfaces (see `mobile-feature-parity` spec: "day-carousel.tsx... settings-sheet.tsx... verified manually").
- **Admin-webapp form**: no automated tests specified — no existing test precedent in `admin-webapp` for form components at this scope; verified manually.

## Out of Scope

- Push notifications (mobile `expo-notifications` / web Push API) — explicitly parked for a future ADR/spec. This spec's entire delivery mechanism is fetch-on-app-open.
- Multiple concurrent announcements / a feed or inbox — only ever one active announcement at a time.
- Editing an announcement's content in place — only create (new row) and clear (deactivate) are supported.
- Rich text/markdown body formatting — plain text only.
- Scheduling/expiry (e.g. "auto-deactivate after N days") — the admin manually clears when a notice is stale.
- Any webapp-specific offline-indicator work — this spec covers the announcement feature itself; the webapp's general offline UX is untouched by this spec.
- Per-user/per-section targeting of announcements — every active announcement is shown to every student regardless of year/section.

## Further Notes

- See [ADR-0002](../../docs/adr/0002-announcements.md) for the full decision rationale (including alternatives considered, like a checkbox-based "don't show again" that was rejected in favor of the settings-entry-point safety net).
- The `CONTEXT.md` glossary now defines **Announcement** — use that term consistently in code/comments/PR descriptions rather than "notice," "banner," or "alert."
- This spec assumes [ADR-0003](../../docs/adr/0003-mobile-offline-hardening.md)'s `onlineManager`/NetInfo wiring lands on `mobile` (separate spec), since the announcement query benefits automatically from that reconnect-refetch behavior — but this spec does not depend on it being implemented first; TanStack Query's default behavior without that wiring simply means the announcement query won't proactively refetch on reconnect until ADR-0003 ships.
