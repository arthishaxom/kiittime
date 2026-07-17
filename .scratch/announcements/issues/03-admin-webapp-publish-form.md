# 03 — admin-webapp: publish/clear announcement form

**What to build:** A form in `admin-webapp` for the admin to publish a new announcement (title, body, optional link label + URL) or clear the current one, calling the ticket 02 endpoints.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] New route `admin-webapp/src/routes/_authenticated/announcements.tsx` calls `POST /admin/announcements` / `POST /admin/announcements/clear` inline via `useMutation` + the existing `apiFetch` helper — matches this codebase's actual convention (route components own their fetch calls directly; `lib/api.ts` is just the thin `apiFetch` wrapper, no per-endpoint functions exist for uploads either) rather than the ticket's originally-assumed `createAnnouncement`/`clearAnnouncement` functions
- [x] Route renders: current-announcement panel (`GET /announcements/current` via `useQuery`) + a publish form (title input, body `Textarea` — new `components/ui/textarea.tsx`, no shadcn textarea existed yet — optional link label + URL inputs, submit button)
- [x] Client-side length limits mirrored (title ≤80, body ≤500, link label ≤30) with a live `n/max` counter per field that turns red and disables Publish when over limit, before the server's `422` would even fire
- [x] "Clear announcement" uses the same `AlertDialog` confirmation pattern as the existing clear-all action (`9f7a1cd`), scoped down to a plain confirm (no type-to-confirm text) since clearing an announcement is reversible by republishing, unlike clear-all's irreversible data wipe
- [x] Publish/clear mutations reset error state on success, show toasts (`sonner`, matching upload flow), and invalidate the current-announcement query so the panel updates immediately; errors surface inline without leaving the form stuck
- [x] Nav link added to the authenticated header (`_authenticated.tsx`) so the route is reachable
- [x] `pnpm exec biome check` clean, `pnpm exec tsc --noEmit` shows no new errors (one pre-existing, unrelated error on `_authenticated.tsx`'s logout navigation), `pnpm run build` succeeds
- [x] Manual verification against a running backend — confirmed working
