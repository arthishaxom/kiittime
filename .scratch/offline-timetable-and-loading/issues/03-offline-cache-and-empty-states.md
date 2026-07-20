Status: resolved
Type: task

Improve the UX for offline states when viewing the timetable (both mobile and web).

- **Cached Data State**: If the network is unavailable but we have cached data via React Query:
  - Do not show a full-screen error.
  - Render the cached timetable data.
  - Add an "offline" icon to the header (same row as sections).
  - Tapping this icon should show a modal/dialog explaining "You are offline. Showing cached data."

- **No Cache Empty State**: If the network is unavailable and there is no cached data:
  - Replace the generic "Failed to load timetable" text with a proper empty state.
  - Show a large offline icon (e.g. slashed Wi-Fi) with friendly text: "You're offline. Please connect to the internet to load your timetable for the first time."
  - Include a "Retry" button to re-trigger the fetch.
