# Mobile app: port webapp features (input, section selection, timetable with draggable tabs, bottom sheet)

## Problem Statement

KIIT Time exists today only as a web app (`webapp/`): pick a class year, search and multi-select your class sections, then view a merged, day-by-day timetable with a swipeable day carousel and a settings sheet (share, reset, contact, about). Students who want this on their phone as a native app currently have nothing — `mobile/` is a bare Expo scaffold with a single placeholder screen and none of the product's actual functionality. Students need the same core flow (pick year → select sections → view timetable) with mobile-native interactions (draggable day tabs, a native bottom sheet) instead of a web page.

## Solution

Build out the `mobile/` Expo app to full feature parity with `webapp/`: a year picker with a returning-user fast path, a searchable multi-select section picker (capped at 5 sections), a timetable screen with a custom gesture-driven draggable day-tab carousel, and a native bottom sheet for settings (share, reset, contact, about). Data fetching, persistence, and the visual theme are ported from the webapp but adapted to RN idioms — AsyncStorage instead of localStorage, TanStack Query with an AsyncStorage persister instead of `PersistQueryClientProvider`+localStorage, Reanimated + Gesture Handler instead of `motion`, and `@gorhom/bottom-sheet` instead of a radix Dialog-as-sheet. The app adopts the webapp's fixed dark palette (itself "ported 1:1" from an Android app) as its only theme — no light/dark switching.

## User Stories

1. As a student opening the app for the first time, I want to pick my year (1–4), so that I only see sections relevant to my year.
2. As a student who hasn't selected sections yet, I want the "Select sections" action disabled until I've picked a year, so that I can't proceed with incomplete input.
3. As a student on the section-selection screen, I want to search sections by name, so that I can find mine quickly in a long list.
4. As a student selecting sections, I want to multi-select up to 5 sections, so that I can see a merged timetable across all my sections (e.g. electives).
5. As a student who has selected 5 sections, I want the remaining unselected rows to visually disable with a "Max 5 sections" message, so that I understand why I can't select more.
6. As a student who selected a 6th-choice section by mistake, I want to still be able to deselect any of my 5 chosen sections, so that I can correct my selection without starting over.
7. As a student reviewing my picks, I want removable chips showing my currently selected sections, so that I can see and adjust my selection at a glance.
8. As a student with 0 sections selected, I want the "Done" button disabled, so that I can't advance without picking at least one section.
9. As a student whose year/search has no matching sections, I want a clear empty-state message with a way to email the maintainer to request my section be added, so that I'm not stuck with no path forward.
10. As a student who has completed section selection, I want my choices persisted on-device, so that I don't have to re-select them every time I open the app.
11. As a returning student who already selected sections, I want the app to skip the year-picker/section-selection screens entirely and land straight on my timetable, so that the app opens directly to what I care about.
12. As a student on the timetable screen, I want to see my merged schedule grouped by day (Mon–Sat), so that I can see all classes across my selected sections for a given day.
13. As a student viewing the timetable, I want the current day tab selected by default (falling back appropriately on Sunday), so that I immediately see today's classes without extra taps.
14. As a student viewing the timetable, I want to tap any day tab to jump to that day, so that I can quickly check a specific day's schedule.
15. As a student viewing the timetable, I want to swipe left/right to move between days, so that I can browse my week with a natural touch gesture instead of only tapping tabs.
16. As a student swiping between days, I want the carousel to show elastic resistance at the Monday/Saturday boundaries rather than a hard stop, so that the interaction feels native and forgiving.
17. As a student swiping less than the snap threshold, I want the carousel to spring back to the current day rather than advancing, so that small/accidental drags don't change my view unexpectedly.
18. As a student scrolling vertically within a busy day's session list, I want that scroll to not be misinterpreted as a horizontal day-swipe, so that the two gestures don't fight each other.
19. As a student viewing a day with no classes, I want a clear "No Classes Today" message, so that I know the day is genuinely empty rather than the app being broken/loading.
20. As a student viewing a session, I want to see the course code, room number, and formatted start time, so that I know where and when to be.
21. As a student, I want a settings entry point (a floating gear button) on the timetable screen, so that I can access share/reset/contact/about actions without cluttering the main view.
22. As a student, I want to share my timetable via my phone's native share sheet, so that I can send a link to classmates through whatever app I prefer (WhatsApp, SMS, etc.).
23. As a recipient of a shared timetable link, I want it to open in a browser (the webapp), so that I can view the schedule even if I don't have the mobile app installed.
24. As a student, I want a one-tap Reset action that clears my saved sections and returns me to the year picker, so that I can start over (e.g. new semester, new sections) without digging through device settings.
25. As a student, I want a Contact action that opens my mail client with a prefilled subject, so that I can easily report an issue or request a section be added.
26. As a student, I want an About screen showing the app version, author/GitHub links, and license, so that I can find project info and provenance.
27. As a student, I want the About screen to be reachable both from the settings sheet on the timetable screen and from the initial year-picker screen, so that I can find app info before I've even selected sections.
28. As a student who taps About while the settings sheet is open, I want both the sheet and the About dialog visible together, so that I don't lose my place in the settings sheet.
29. As a student whose device has no connectivity after a previous successful load, I want my last-fetched timetable to still render from cache, so that a temporary network drop doesn't leave me with a blank screen.
30. As a student, I want the fetch of sections/timetable data to fail gracefully with a plain error message (no crash), so that transient API/network issues don't break the app.
31. As a developer, I want a `kiittime://timetable?section_id=...` deep link to open directly to that timetable, so that future features (QR codes, notifications) have a working link target to build on.
32. As a developer, I want the app's visual theme to be a single fixed dark palette matching the webapp exactly, so that both platforms present a consistent brand identity without the added complexity of a light theme nobody has designed yet.

## Implementation Decisions

- **Bottom sheet**: `@gorhom/bottom-sheet` for the settings sheet, not a hand-rolled Reanimated sheet. Requires `GestureHandlerRootView` (app root, outermost) and `BottomSheetModalProvider` wrapping the navigation tree. Sheet uses `enableDynamicSizing` (content-sized, no fixed snap points) and `BottomSheetBackdrop` (`disappearsOnIndex={-1}`, `appearsOnIndex={0}`, `pressBehavior="close"`). Sheet chrome (`backgroundStyle`/`handleIndicatorStyle`) uses the `sheet` token (`#181818`), distinct from the `surface` token used elsewhere, matching the webapp's layering.
- **Draggable day-tab carousel**: a custom component (not `react-native-pager-view`, not the existing `tabs.tsx` segmented-control primitive) built on Reanimated + Gesture Handler's `Gesture.Pan()` API. State: a Reanimated shared value drives horizontal `translateX` (analog of the webapp's `useMotionValue`); `activeIndex` is mirrored as both React state (tab-strip highlight) and a shared value (read on the gesture thread). `goTo(index)` clamps and animates via `withSpring(-index * containerWidth, { damping: 40, stiffness: 400 })`, matching the webapp's spring constants. The pan gesture uses `.activeOffsetX([-10, 10])` so vertical scrolling inside a day panel isn't hijacked, applies ~0.15 elastic dampening past the first/last day bounds (matching the webapp's `dragElastic={0.15}`), and snaps on release using the same 20%-of-container-width threshold as the webapp. `containerWidth` is measured via `onLayout`. Initial day index defaults to today, using the same Mon=0..Sat=5 remap as the webapp (Sunday folds to index 5).
- **Data/state layer**: `@tanstack/react-query` + `@react-native-async-storage/async-storage`, mirroring the webapp's `api.ts`/hook structure as closely as RN idioms allow:
  - `Section = { id: number; section_name: string; year: number }`, `Session = { day; period_number; start_time /* "HH:MM:SS" */; course_code; course_name; faculty_name; room_number; section }`, `Timetable = { sections_requested: string[]; sessions: Session[] }` — types carried over unchanged.
  - `fetchSections(year?)` → `GET /sections/?year={year}`; `fetchTimetable(sectionIds)` → `GET /timetable/?section_id=1&section_id=2...`; `formatTime(time)` — same contracts as the webapp, base URL from `EXPO_PUBLIC_API_BASE_URL` (default `https://kiittime-backend.onrender.com`).
  - `useSections(year)` / `useTimetable(sectionIds)` — thin query wrappers with the same `enabled` guards as the webapp.
  - AsyncStorage-backed persister (`@tanstack/query-async-storage-persister`) with 1-day `gcTime`/`maxAge`, giving the same offline/fast-reload behavior as the webapp's localStorage-persisted query client.
  - Section-id persistence: `getSavedSectionIds`/`saveSectionIds`/`clearSavedSectionIds`, same storage key (`kiit-time:selected-sections`) as the webapp, now async (AsyncStorage vs. synchronous localStorage).
- **Section selection cap**: multi-select capped at 5 sections. Once 5 are selected, unselected rows become visually disabled/non-interactive and an inline "Max 5 sections" message appears near the selected-chips row; already-selected rows remain tappable to deselect. This is a mobile-only constraint — the webapp has no cap.
- **Section list UI**: custom `Pressable` rows, not the existing `@rn-primitives`-based `toggle-group.tsx` (its string-keyed value model doesn't map naturally onto a searchable, badge-synced list of numeric section ids).
- **Fast-path/returning-user redirect**: on app launch, hold the native splash screen (`SplashScreen.preventAutoHideAsync()`/`hideAsync()`) until the saved-section check resolves, then either redirect straight to `/timetable` or reveal the year picker — avoids any flash of the picker for returning users. (expo-router has no `beforeLoad`-equivalent hook, so this is done in the entry screen's mount effect instead.)
- **Search-param encoding**: `section_id` is passed as a string array via expo-router's `params`, normalized back to `number[]` consistently (shared helper) across the entry screen, section-selection screen, and timetable screen — same semantics as the webapp's zod-validated, catch-to-`[]` array param.
- **Deep linking**: `kiittime://timetable?section_id=...` resolved via expo-router's default file-based linking (existing `kiittime` scheme in `app.config.js`), verified rather than custom-built. No current producer of these links (Share sends a webapp URL, not a deep link) — this exists for future use (QR codes, notifications).
- **Share**: shares a link to the webapp's timetable (`https://<webapp-domain>/timetable?section_id=...`) via RN's built-in `Share` API, so recipients without the mobile app can still open it in a browser. Copy is verbatim from the webapp: title "My KIIT Time Timetable", message "Check out my class schedule". RN's `url` share field is iOS-only, so the URL is also embedded in the shared message text for Android. No clipboard fallback — RN's `Share.share()` has no "unsupported browser" gap the way `navigator.share` does on web, so a thrown/cancelled share fails silently (same as the webapp's catch-and-ignore-cancel behavior).
- **Reset**: single immediate tap, no confirmation dialog (matches the webapp exactly). Clears both `clearSavedSectionIds()` (AsyncStorage) and the in-memory query cache (`queryClient.clear()`) — the latter has no webapp equivalent, since a full page navigation on web implicitly drops in-memory state, but RN's persistent JS context does not. Then navigates back to the year picker.
- **Contact**: `Linking.openURL(buildMailto(...))`, with `buildMailto`'s subject/body-building logic carried over unchanged from the webapp; only the call site (`Linking.openURL` vs. an `<a href>`) differs.
- **About**: a dialog built directly on the existing `dialog.tsx` primitives (`Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`), reachable from both the year-picker screen and the timetable settings sheet. Content (version via `Constants.expoConfig?.version`, author/GitHub links, license) ported verbatim from the webapp's `AboutDialog`. Tapping "About" from within the settings sheet does not dismiss the sheet first — both surfaces can be visible simultaneously (dialog on top).
- **Error handling**: `useSections`/`useTimetable` failures render plain error text only, no manual retry affordance — parity with the webapp; TanStack Query's default background retry still applies underneath.
- **No pull-to-refresh**: selecting sections triggers a fresh fetch, and app relaunch re-fetches/re-hydrates from the persisted cache, so no manual refresh affordance is needed on the timetable screen.
- **Theme**: the webapp's dark palette is adopted as mobile's sole theme (`bg #121212`, `surface #1e1e1e`, `sheet #181818`, `pill #161616`, `border #414040`/`#272625`, `brand #f57c00`, `brand-active #ff8000`, `text #ffffff`, `text-muted #d4d4d4`, `danger #e42a33`), replacing the scaffold's generic/unused shadcn neutral tokens. No light/dark switching is built — this palette was itself "ported 1:1" from an Android app, so there is no separate light design to port.
- **Existing UI primitives reused as-is**: `button.tsx`, `input.tsx`, `badge.tsx`, `text.tsx` (+ its `TextClassContext`), `icon.tsx`, `dialog.tsx`. Existing assets reused: `logo-no-bg.png`/`logo-with-bg.png` from `mobile/assets/images/` (year-picker header / About screen) — no new visual assets needed. `tabs.tsx` (segmented-control primitive) and `select.tsx` are not used by this feature.

## Testing Decisions

- Good tests here exercise external behavior (inputs → outputs of a pure function) rather than internals — no snapshotting of gesture/animation internals, no testing of `@gorhom/bottom-sheet` or Reanimated internals directly.
- **Test seam**: the pure `src/lib/*` layer, since it has no React/gesture dependencies and is straightforward to isolate:
  - `api.ts` — `fetchSections`/`fetchTimetable` request-shape and response-parsing behavior (mocked fetch), `formatTime` input/output pairs.
  - `storage.ts` — `getSavedSectionIds`/`saveSectionIds`/`clearSavedSectionIds` round-trip and malformed-data fallback-to-null behavior.
  - `timetable.ts` — `groupSessionsByDay` (grouping/sort-by-period correctness, including an empty-sessions case) and `parseSectionIdParam` (string / string[] / undefined normalization, catch-to-`[]` behavior).
  - `mailto.ts` — `buildMailto` produces the expected `mailto:` string for given subject/body inputs.
  - `share.ts` — the URL-building portion of `shareTimetable` (given section ids, produces the expected webapp URL/message text), not the native `Share.share()` call itself.
- No test runner currently exists in `mobile/`; introduce a lightweight one (Vitest, consistent with the webapp's tooling) scoped to this pure-function layer only.
- **Not covered by automated tests** — verified manually per this spec's existing manual-QA checklist instead, since gesture/animation and native-module UI have no established automated-testing convention in this repo yet: `day-carousel.tsx` (pan gesture, spring/elastic behavior, snap thresholds), `settings-sheet.tsx` (native bottom sheet behavior), and the screens themselves (`index.tsx`, `select/sections.tsx`, `timetable.tsx`).
- Prior art: none in this repo yet (this introduces the first test tooling in `mobile/`); the webapp also has no existing test suite to mirror.

## Out of Scope

- Light theme / theme switching — mobile ships the fixed dark palette only.
- Pull-to-refresh on the timetable screen.
- A confirmation dialog before Reset.
- An `expo-clipboard` share fallback.
- Any producer of `kiittime://` deep links (QR codes, push notifications) — only the consumer side (the link resolving to the right screen) is in scope.
- Automated/E2E testing of gesture, animation, or native bottom-sheet behavior — covered by manual verification only.
- Any backend/API changes — the mobile app consumes the existing `kiittime-backend` API unchanged.
- Onboarding flows beyond year + section selection (e.g. accounts, push-notification opt-in, tutorials).

## Further Notes

- Local dev against a local backend requires setting `EXPO_PUBLIC_API_BASE_URL` to the host machine's LAN IP — `127.0.0.1` does not reach the host from a device/simulator, unlike Vite's dev server on web.
- `@gorhom/bottom-sheet` and `@react-native-async-storage/async-storage` are native modules — verification must run on an Expo dev-client build, not Expo Go.
- Manual verification checklist (cold start, search/select/cap behavior, day-carousel gestures, empty day, settings-sheet actions, fast-path relaunch, offline cache, deep link, dark-palette visual pass) is retained from the prior planning pass and should be run end-to-end before considering this feature complete.
