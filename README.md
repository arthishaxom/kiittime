# KiiTime - Timetable App (Minimal Setup)

A React Native timetable application with a minimal, robust architecture.

## Features

- **AsyncStorage**: Local, persistent storage for roll number and timetable
- **Simple React State**: For UI and loading
- **Expo Router**: File-based navigation
- **Error Handling**: User-friendly alerts for all error cases

## User Flow

1. **First time:**
   - User enters roll number
   - App fetches timetable from API
   - If found, both roll number and timetable are stored in AsyncStorage
   - User is navigated to the timetable page
2. **Returning:**
   - On app launch, if both roll number and timetable are present in AsyncStorage, user is navigated directly to the timetable page (no fetching)
3. **Reset/Logout:**
   - User can clear stored data and return to the roll input screen

## Project Structure

```
kiittime/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx        # Splash screen
│   ├── rollinput.tsx    # Roll input screen
│   └── timetable.tsx    # Timetable display
├── services/
│   └── supabase.ts      # API fetch logic
├── assets/
│   ├── fonts/
│   └── images/
...
```

## How It Works

- **All data is stored in AsyncStorage** after the first successful fetch.
- **No fetching** is done on app start if data is present.
- **All error cases** (invalid roll, not found, network) are handled with alerts.
- **No Zustand or Tanstack Query**—just React state and AsyncStorage.

## Example Code

See `app/index.tsx`, `app/rollinput.tsx`, and `app/timetable.tsx` for the full flow.

## Installation

1. `pnpm install`
2. `pnpm start`

## License

MIT License
