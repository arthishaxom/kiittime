# Mobile Offline Hardening

**Status:** ready-for-agent

## Problem Statement

`mobile/` already persists TanStack Query's cache to `AsyncStorage`, delivering the baseline promise from the `mobile-feature-parity` spec: a temporary network drop still renders the last-fetched timetable from cache. Auditing that baseline (not in response to a specific incident) surfaced four gaps: the UI gives no signal that displayed data might be stale/cached, `refetchOnReconnect` silently never fires on React Native (no `window.online` equivalent), fetch failures show generic error text regardless of cause, and — most seriously — the persisted cache is fully discarded (not just marked stale) after 24 hours without a successful sync, defeating the offline fallback for any realistic multi-day connectivity gap.

## Solution

Wire `@react-native-community/netinfo` into the existing TanStack Query setup to close all four gaps: a visible offline indicator, working reconnect-refetch via `onlineManager`, connectivity-aware error copy, and a longer, safer cache-retention window.

## User Stories

1. As a student viewing my timetable while offline, I want a small, non-blocking banner telling me I'm offline and seeing a saved timetable, so that I know not to fully trust room/time details that may have changed since my last sync.
2. As a student who regains connectivity while the app is open, I want the timetable (and any other stale data) to refetch automatically, so that I don't have to force-close and reopen the app to get current data.
3. As a student opening the app with zero cached data and no internet connection, I want a specific "no internet connection — connect once to load your timetable" message rather than a generic error, so that I understand the actual cause and what to do about it.
4. As a student opening the app with zero cached data due to an actual server/API failure (not connectivity), I want the existing generic error text to still show in that case, so that offline-specific copy doesn't mislead me when the real problem is server-side.
5. As a student who hasn't opened the app in several days (e.g. over a weekend or holiday) and then loses connectivity, I want my last-synced timetable to still be available from cache, so that a multi-day gap between opens doesn't wipe out the offline fallback the rest of this feature depends on.
6. As a developer, I want the announcement feature ([announcements spec](../announcements/spec.md)) to automatically benefit from the same reconnect-refetch wiring, so that a new announcement is discovered as soon as connectivity returns, without separate handling.

## Implementation Decisions

- **New dependency**: `@react-native-community/netinfo`, added once and reused across all four gaps below (banner, `onlineManager`, error copy). Native module — requires a dev-client build to verify, not usable in Expo Go, consistent with the existing `@gorhom/bottom-sheet`/AsyncStorage caveat already documented in the `mobile-feature-parity` spec.
- **Offline banner**: a small, non-blocking pill rendered on the timetable screen whenever `NetInfo` reports no connection ("You're offline — showing saved timetable"). Purely presentational, driven directly off `NetInfo`'s connectivity state.
- **`onlineManager` wiring**: `onlineManager.setEventListener()` bound to `NetInfo.addEventListener()` once at app startup, inside the existing `query-client.tsx`. This makes TanStack Query's default `refetchOnReconnect: true` actually functional on React Native — it covers every query in the app, including `useSections`/`useTimetable` and the announcement query, with no per-query changes needed.
- **Differentiated error copy**: when `useSections`/`useTimetable` fail with no cached data available to fall back on, render "No internet connection — connect once to load your timetable" if `NetInfo` reports offline at that moment, otherwise render the existing generic error text unchanged. No retry button is added — this is a copy change gated on a signal already available from the `NetInfo` wiring above, not a new interaction surface; the existing "no manual retry, parity with webapp" decision from `mobile-feature-parity` stands as-is.
- **Cache retention window**: `gcTime`/`maxAge` in `query-client.tsx` raised from 1 day (`ONE_DAY`) to 7 days. `staleTime` is unchanged (default 0) — whenever the device has connectivity, every mount still triggers a background refetch for fresh data. The 7-day change only affects how long the *persisted* cache survives being discarded on app cold-start without a successful sync in between.

## Testing Decisions

- Good tests here exercise external behavior (pure function inputs → outputs), matching the philosophy established in `mobile-feature-parity`'s Testing Decisions.
- **Pure seam**: the differentiated-error-copy logic, extracted as a pure function (e.g. `getErrorMessage(isOffline: boolean, hasCachedData: boolean) → string`) — tested the same way `mailto.ts`/`share.ts` are today (input/output pairs, no rendering involved).
- **Not covered by automated tests**: the `onlineManager`/`NetInfo` wiring itself (event-listener plumbing, not pure logic), the offline banner's rendering, and the `gcTime`/`maxAge` persister behavior change — verified manually, consistent with this repo's existing precedent for native-module/wiring code (`day-carousel.tsx`, `settings-sheet.tsx` in `mobile-feature-parity` are similarly manual-only). Manual verification should include: toggling airplane mode with a warm cache (banner appears, cached timetable still renders), toggling it back off (banner disappears, refetch fires without a manual reload), a cold start with zero cache while offline (new error copy appears), and confirming a cache from >1 day but <7 days old still survives a cold start (regression check for the `gcTime`/`maxAge` bump).

## Out of Scope

- Any webapp-side equivalent of the offline banner or differentiated error copy — this spec is mobile-only. Webapp parity was raised during grilling but explicitly left undecided; a future spec if desired.
- A manual "retry" button or pull-to-refresh — neither is introduced by this spec.
- Prefetching/pre-warming likely next queries (e.g. other section combinations) — not addressed here.
- Any change to `staleTime` or online fetch-triggering behavior — this spec only changes offline/reconnect/stale-cache handling.
- Push notifications — unrelated to this spec, tracked separately (see the [announcements spec](../announcements/spec.md)'s Out of Scope).

## Further Notes

- See [ADR-0003](../../docs/adr/0003-mobile-offline-hardening.md) for the full decision rationale.
- This spec's `onlineManager` wiring is a dependency the [announcements spec](../announcements/spec.md) benefits from but does not require — implementation order between the two specs is not constrained.
