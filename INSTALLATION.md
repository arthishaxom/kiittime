# Installation Guide (Minimal Setup)

This guide will help you set up the KiiTime project with the new, minimal AsyncStorage-only architecture.

## Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm
- Expo CLI
- Git

## Quick Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd kiittime
   ```
2. **Install dependencies:**
   ```bash
   pnpm install
   ```
3. **Start the development server:**
   ```bash
   pnpm start
   ```

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

- **First time:** User enters roll, fetches timetable, both are stored locally.
- **Returning:** If both are present, user goes straight to timetable, no fetch.
- **Reset:** User can clear data and start over.
- **All error cases** are handled with user feedback.

## No Zustand or Tanstack Query Needed

- All state is managed with React and AsyncStorage.
- No extra state management or caching libraries required.

## License

MIT License 