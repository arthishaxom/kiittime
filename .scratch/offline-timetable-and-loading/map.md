# Map: Offline Timetable & Loading

## Decisions-so-far
- Skeleton loading will be implemented using `react-native-reusables` (mobile) and `shadcn-ui` (web), imitating the day tabs and session cards.
- When offline with cache, the app will show cached data + an offline icon in the header (which opens a modal explaining the offline state).
- When offline with no cache, the app will show a friendly empty state (slashed Wi-Fi icon, "You're offline..." text, and Retry button).
- The section header will show summarized text ("Section A + 2 others") with a chevron. Tapping opens a modal to see all sections, the active roll number, and a "Relink Roll Number" button.
- Version bump both webapp and mobile to their next minor versions (e.g. `pnpm version minor`) upon completing the implementation.

