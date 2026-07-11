# KiiTime - Timetable App

A React Native timetable application for KIIT University students with offline-first architecture.

## Features

- **Dual Input Modes**: Enter roll number OR select sections
- **Offline-First**: Cached data with React Query (7-day storage)
- **AsyncStorage Persistence**: User preferences persist across sessions
- **Push Notifications**: Class reminders using Notifee
- **Expo Router**: File-based navigation
- **Error Handling**: Comprehensive error handling with user feedback
- **State Management**: Zustand with AsyncStorage persistence

## User Flow

### First Time User
1. **Choose input method:**
   - Option A: Enter roll number (e.g., 22051234)
   - Option B: Select sections (e.g., CSE-1, CSE-2) + year
2. **Data fetching:**
   - App fetches timetable from Supabase API
   - Data is cached with React Query
   - User preferences stored in AsyncStorage
3. **Timetable display:**
   - User navigated to timetable screen
   - Can set notification preferences (10-30 min before class)

### Returning User
1. **Automatic login:**
   - App checks AsyncStorage for saved config
   - Loads cached timetable from React Query
   - User goes directly to timetable (no network needed)
2. **Offline mode:**
   - App works without internet
   - Cached data persists for 7 days
   - Automatic cache invalidation after 5 minutes

### Reset/Change Timetable
- Clear button in timetable screen
- Removes all cached data
- Returns to input selection screen

## Tech Stack

- **React Native** - Mobile framework
- **Expo** - Development platform with custom dev client
- **TypeScript** - Type safety
- **Expo Router** - File-based routing
- **Zustand** - State management with AsyncStorage persistence
- **TanStack Query (React Query)** - Server state caching
- **Notifee** - Local push notifications (Android)
- **GlueStack UI** - Component library
- **Supabase** - Backend API (PostgreSQL + RPC)

## Project Structure

```
kiittime/
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Root layout
│   │   ├── index.tsx                # Entry point with routing
│   │   ├── roll-input.tsx           # Roll number input
│   │   ├── section-selection.tsx    # Section selection
│   │   ├── timetable.tsx            # Timetable display
│   │   └── not-found.tsx            # Error page
│   ├── components/
│   │   ├── ClassCard.tsx            # Class card UI
│   │   ├── Timetable.tsx            # Timetable component
│   │   ├── RollInput.tsx            # Roll input form
│   │   └── SectionSelector.tsx      # Section selector
│   ├── hooks/
│   │   ├── queries.ts               # React Query hooks
│   │   └── useFonts.ts              # Font loading
│   ├── services/
│   │   ├── supabase.ts              # Supabase client
│   │   └── timetable.api.ts         # API functions
│   ├── store/
│   │   ├── appStore.ts              # Zustand store
│   │   └── appState.ts              # Store types
│   └── utils/
│       ├── constants.ts             # App constants
│       ├── helpers.ts               # Utility functions
│       └── notifications.ts         # Notification service
├── android/                         # Android native code
├── assets/                          # Fonts, images
└── app.config.ts                    # Expo config
```

## Architecture

### Data Flow
1. **User Input** → Roll number or sections
2. **API Call** → Supabase RPC function
3. **Cache Layer** → React Query stores data
4. **Persistence** → AsyncStorage saves preferences
5. **UI Rendering** → Timetable component displays data

### Offline-First Strategy
- React Query caches all API responses
- `networkMode: "offlineFirst"` enables offline access
- AsyncStorage persists user config (roll/sections/year)
- 7-day garbage collection prevents stale data
- 5-minute stale time for automatic refetch

### Notification System
- Uses Notifee for local Android notifications
- Weekly recurring reminders (10-30 min before class)
- Configured per user preference
- Persists across app restarts

## Quick Start

### Development
```bash
# Install dependencies
pnpm install

# Windows (PowerShell)
$env:APP_VARIANT = "development" ; pnpm start

# Linux/macOS
APP_VARIANT=development pnpm start
```

**Note:** You need to build a development client first. See [INSTALLATION.md](INSTALLATION.md) for detailed setup.

## Documentation

- **[Installation Guide](INSTALLATION.md)** - Complete setup with EAS development client

## License

MIT License
