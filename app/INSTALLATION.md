# Installation Guide

This guide will help you set up the KiiTime project for development.

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10.12.1 or higher)
- Git
- Android Studio (for Android development)
- EAS CLI (for building development client)

## Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/arthishaxom/kiittime.git
cd kiittime
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Install EAS CLI
```bash
npm install -g eas-cli
```

### 4. Login to Expo
```bash
eas login
```
If you don't have an Expo account, create one at [expo.dev](https://expo.dev).

### 5. Configure EAS project
```bash
eas build:configure
```
This will link the project to your Expo account.

### 6. Build the development client

**Option A: Build for Android device/emulator**
```bash
eas build --profile development --platform android
```
- Download the APK when build completes
- Install on your Android device or emulator

**Option B: Build locally (faster)**
```bash
eas build --profile development --platform android --local
```
Requires Android SDK and environment setup.

### 7. Start the development server

**Windows (PowerShell):**
```powershell
$env:APP_VARIANT = "development" ; pnpm start
```

**Linux/macOS:**
```bash
APP_VARIANT=development pnpm start
```

Then:
- Press `a` to open in development client on Android
- Scan QR code with the development client app you built

## Project Structure

```
kiittime/
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Root layout
│   │   ├── index.tsx                # Entry point with routing logic
│   │   ├── roll-input.tsx           # Roll number input screen
│   │   ├── section-selection.tsx    # Section selection screen
│   │   ├── timetable.tsx            # Timetable display screen
│   │   ├── privacy-policy.tsx       # Privacy policy page
│   │   └── not-found.tsx            # Error page
│   ├── components/
│   │   ├── ClassCard.tsx            # Individual class card
│   │   ├── Timetable.tsx            # Timetable component
│   │   ├── RollInput.tsx            # Roll input form
│   │   ├── SectionSelector.tsx      # Section selection UI
│   │   └── ui/                      # UI components (GlueStack)
│   ├── hooks/
│   │   ├── queries.ts               # React Query hooks
│   │   └── useFonts.ts              # Font loading hook
│   ├── services/
│   │   ├── supabase.ts              # Supabase API client
│   │   └── timetable.api.ts         # Timetable API functions
│   ├── store/
│   │   ├── appStore.ts              # Zustand store with persistence
│   │   └── appState.ts              # Store types
│   └── utils/
│       ├── constants.ts             # App constants
│       ├── helpers.ts               # Helper functions
│       └── notifications.ts         # Notification utilities
├── android/                         # Android native code
├── assets/                          # Static assets
└── app.config.ts                    # Expo configuration
```

## Why Development Client?

The app uses native modules (like Notifee) that aren't supported in Expo Go. A development client is a custom version of Expo Go built specifically for this project with all required native dependencies.

**Benefits:**
- Fast refresh and hot reloading
- Full access to native modules
- Debug with React DevTools
- No need to rebuild for code changes

## How It Works

### State Management
- **Zustand**: Global state management with AsyncStorage persistence
- **React Query**: Server state caching with 7-day garbage collection
- **AsyncStorage**: Persistent storage for user preferences

### User Flow
1. **First time user**: 
   - Enter roll number OR select sections
   - Data fetched from Supabase
   - Timetable cached and displayed
   
2. **Returning user**:
   - App loads cached data from React Query + AsyncStorage
   - User goes directly to timetable
   - Offline-first approach ensures app works without network

3. **Data refresh**:
   - User can clear data and re-fetch
   - Cache automatically updates on new requests

## Troubleshooting

### Common Issues

1. **Development build fails**
   - Ensure you're logged in: `eas login`
   - Check pnpm version: `pnpm --version` (should be 10.12.1+)
   - Try building with `--local` flag if cloud build fails

2. **Can't connect to dev server**
   - Make sure device and computer are on same network
   - Try running: `pnpm start --tunnel`
   - Check if development client is installed on device

3. **App crashes on startup**
   - Check Supabase credentials
   - Clear app data and reinstall development client
   - Check console logs in terminal

4. **Build takes too long**
   - Cloud builds can take 10-20 minutes
   - Use `--local` flag for faster builds (requires Android SDK)

## Useful Commands

**Windows (PowerShell):**
```powershell
# Start development server
$env:APP_VARIANT = "development" ; pnpm start

# Start with tunnel (if local network doesn't work)
$env:APP_VARIANT = "development" ; pnpm start --tunnel

# Clear cache
$env:APP_VARIANT = "development" ; pnpm start --clear
```

**Linux/macOS:**
```bash
# Start development server
APP_VARIANT=development pnpm start

# Start with tunnel (if local network doesn't work)
APP_VARIANT=development pnpm start --tunnel

# Clear cache
APP_VARIANT=development pnpm start --clear
```

**Common commands (all platforms):**
```bash

# Build development client (cloud)
eas build --profile development --platform android

# Build development client (local, faster)
eas build --profile development --platform android --local

# View your builds
eas build:list

# Type checking
pnpm typecheck

# Lint code
pnpm lint

# Format code
pnpm format
```

## Need Help?

- Check [Expo Documentation](https://docs.expo.dev)
- Visit [Expo Forums](https://forums.expo.dev)
- Check project issues on GitHub

## License

MIT License 