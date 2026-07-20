# Offline Timetable and Loading States

## Overview
This feature improves the UX around the timetable module when loading data and handling offline states. Currently, the app shows generic error messages when offline even if cached data exists, displays simple text during loading instead of skeleton states, and has a congested header for selecting multiple sections.

## Goals & Decisions
1. **Skeleton Loading States:**
   - Replace the generic "Loading timetable..." text with skeleton placeholders.
   - The skeleton should mimic the actual UI structure: static day tabs at the top, and 3-4 pulsating empty session cards below.
   - Use `react-native-reusables` (via CLI) for mobile, and `shadcn-ui` (via CLI) for web. Use `pnpm` for installation.

2. **Handling Offline State with Cached Data:**
   - If the user is offline but has locally cached timetable data (from `PersistQueryClientProvider`), do not show an error screen.
   - Display the cached data and place a small offline icon in the header (same row as sections).
   - Tapping the offline icon opens a modal explaining that the app is offline and showing cached data.

3. **Complete Offline State (No Cache):**
   - If the user is offline and has *zero* cached data, show a friendly empty state.
   - This should include a large offline icon (e.g. slashed Wi-Fi) with text: "You're offline. Please connect to the internet to load your timetable for the first time." and a "Retry" button.

4. **Sections Header Congestion UX:**
   - Prevent the section header from overflowing when 3-4 sections are selected.
   - Instead of listing all sections, summarize the text (e.g., if 1 section: "Section A", if >1 section: "Section A + 2 others").
   - Include a dropdown chevron next to the text. Tapping the text/chevron opens a modal.
   - The modal will list all selected sections and the current active roll number, and include an action button to "Relink Roll Number".

5: **Version Bump:**
   - Version bump the mobile app (from `2.2.0` to `2.3.0`) and the webapp (from `1.3.0` to `1.4.0`) using `pnpm version minor` (since these are new features).

