# 01 — Foundation: dependencies, theme, root layout, data layer

**What to build:** Lay the groundwork every other ticket in this feature depends on: new dependencies installed, the app's fixed dark theme applied, the root layout wired with gesture/query/bottom-sheet providers, and the pure data-access layer (API client, storage, query hooks) built and tested. Nothing user-facing changes yet beyond the app rendering with the correct theme, but every subsequent ticket needs this in place.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `@react-native-async-storage/async-storage`, `@gorhom/bottom-sheet` installed (via `expo install` where native); `lucide-react-native` confirmed as an explicit dependency
- [x] Jest configured as the test runner for `mobile/` (not Vitest)
- [x] Root layout (`_layout.tsx`) wraps the app in `GestureHandlerRootView` → `ThemeProvider` → a new `QueryProvider` → `BottomSheetModalProvider` → `Stack` (headers hidden) → `PortalHost`; placeholder debug banner removed
- [x] `global.css`/`theme.ts` tokens replaced with the webapp's fixed dark palette (`bg #121212`, `surface #1e1e1e`, `sheet #181818`, `pill #161616`, `border #414040`/`#272625`, `brand #f57c00`, `brand-active #ff8000`, `text #ffffff`, `text-muted #d4d4d4`, `danger #e42a33`); no light/dark switching
- [x] `src/lib/api.ts` built: `Section`/`Session`/`Timetable` types, `fetchSections`, `fetchTimetable`, `formatTime`, base URL from `EXPO_PUBLIC_API_BASE_URL` (default `https://kiittime-backend.onrender.com`)
- [x] `src/lib/storage.ts` built: async `getSavedSectionIds`/`saveSectionIds`/`clearSavedSectionIds` over AsyncStorage, key `kiit-time:selected-sections`
- [x] `src/hooks/useSections.ts`, `src/hooks/useTimetable.ts` built as TanStack Query wrappers with the same `enabled` guards as the webapp
- [x] `QueryProvider` wraps `PersistQueryClientProvider` with an AsyncStorage persister, 1-day `gcTime`/`maxAge`
- [x] Jest tests cover `api.ts` (request shape, response parsing, `formatTime` input/output pairs) and `storage.ts` (round-trip, malformed-data-to-null fallback)
- [x] Verifiable end-to-end: app launches showing the correct dark palette, and a manual smoke check (e.g. a temporary screen or REPL call) confirms `fetchSections`/`getSavedSectionIds` work against the real API/AsyncStorage
