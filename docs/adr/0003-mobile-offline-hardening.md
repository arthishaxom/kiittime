# 3. Mobile Offline Hardening

Date: 2026-07-16

## Status

Accepted

## Context

`mobile/` already persists TanStack Query's cache to `AsyncStorage` (`PersistQueryClientProvider` + `createAsyncStoragePersister`, `gcTime`/`maxAge: ONE_DAY`), delivering the baseline promise from the `mobile-feature-parity` spec (story 29): a temporary network drop still renders the last-fetched timetable from cache. Auditing that baseline surfaced four concrete gaps rather than one incident:

1. No signal distinguishing "live data" from "cached data shown because the device is offline" — the UI looks identical either way.
2. `refetchOnReconnect` (TanStack Query's default) never fires on React Native, because RN has no `window.online`/`navigator.onLine` event for the query client to observe — unlike the web, where the webapp gets this behavior for free.
3. Sections/timetable fetch failures render generic error text regardless of cause (offline vs. server error), giving the user no actionable signal.
4. `maxAge: ONE_DAY` on the persister means the persisted cache is **discarded, not just marked stale**, if the app hasn't successfully synced in over 24 hours — silently defeating the offline fallback for any gap longer than a day (weekend, holiday, dead zone), which is a plausible scenario, not an edge case.

## Decision

- Add `@react-native-community/netinfo` as the single new dependency covering all four gaps.
- **Offline banner**: a small non-blocking pill ("You're offline — showing saved timetable") rendered on the timetable screen whenever `NetInfo` reports no connection.
- **`onlineManager` wiring**: `onlineManager.setEventListener()` bound to `NetInfo.addEventListener()` once at app startup (in `query-client.tsx`), so TanStack Query's default `refetchOnReconnect` actually fires the moment connectivity returns — covering both the timetable/sections queries and the announcement query from ADR-0002.
- **Differentiated error copy**: when a fetch fails with no cached data available, show "No internet connection — connect once to load your timetable" if `NetInfo` reports offline, vs. the existing generic error text otherwise. No retry button is added — this is a copy change gated on a signal we already have, not a new interaction surface; the "no manual retry, parity with webapp" decision from the original spec stands.
- **`gcTime`/`maxAge` raised from 1 day to 7 days.** `staleTime` is unchanged (default 0) — whenever the app has connectivity, it still refetches fresh data on every mount. This only changes how long the offline fallback survives without a successful sync. Bounded at 7 days (not indefinite) since timetable data can drift meaningfully over a full semester; 7 days covers ordinary multi-day connectivity gaps without risking stale-for-months data.

## Consequences

- One new native-module dependency (`@react-native-community/netinfo`) — same caveat as `@gorhom/bottom-sheet`/AsyncStorage: requires a dev-client build, not verifiable in Expo Go.
- The announcement feature (ADR-0002) benefits automatically from the `onlineManager` wiring — no separate reconnect-handling needed for the announcement query.
- Webapp parity for the offline banner / differentiated error copy was raised but explicitly **not decided here** — left open for a follow-up pass if desired.
- No changes to `staleTime` or fetch triggers while online — this ADR only affects offline/reconnect/stale-cache behavior.
