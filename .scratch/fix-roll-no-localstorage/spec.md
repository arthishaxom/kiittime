Status: ready-for-agent

## Problem Statement

When a user onboards via roll number fetching or OTP verification on both the Web and Mobile apps, their `active-roll-no` and `active-academic-year` are currently not being persisted into local storage. However, the timetable view expects to read these values to display the user's active roll number and enable the edit sections flow (via the pencil icon). 

## Solution

We need to persist the active roll number and academic year into storage (LocalStorage for Web, AsyncStorage for Mobile) when onboarding is completed (in `Landing.tsx` / `index.tsx`) and when OTP verification succeeds (in `SectionSearch.tsx` / `select/sections.tsx`). Furthermore, when the user resets the timetable, these keys must be explicitly cleared to ensure proper reset state.

## User Stories

1. As a user, I want my active roll number and academic year to be saved after I fetch my roll number mapping, so that the timetable view remembers my identity across sessions and allows me to edit my sections.
2. As a user, I want my active roll number and academic year to be saved after I verify via OTP, so that my identity is linked to the sections I manually selected.
3. As a user, I want my roll number and academic year data to be cleared from storage when I reset my timetable, so that no residual user identity remains on the device.
4. As a developer, I want the web app to use constants for storage keys rather than raw strings, so that I don't accidentally introduce typos when reading/writing to `localStorage`.
5. As a developer, I want the mobile app to have explicit getter, setter, and clearer functions for active roll number and academic year in the central `storage.ts` module, so that platform-specific storage is safely abstracted.

## Implementation Decisions

- The web app (`webapp/src/routes/timetable.tsx`, `Landing.tsx`, `SectionSearch.tsx`) will be updated to use defined string constants for `kiit-time:active-roll-no` and `kiit-time:active-academic-year`.
- We will update `webapp/src/components/Landing.tsx` and `webapp/src/components/SectionSearch.tsx` to set both keys after successfully obtaining `RollNumberMappingOut` from the API.
- We will update `handleReset` in `webapp/src/routes/timetable.tsx` to call `removeItem` on these keys.
- For the mobile app, we will define `getActiveRollNo`, `setActiveRollNo`, `clearActiveRollNo`, `getActiveAcademicYear`, `setActiveAcademicYear`, and `clearActiveAcademicYear` in `mobile/src/lib/storage.ts`.
- We will invoke these setters in `mobile/src/app/index.tsx` (after fetching) and `mobile/src/app/select/sections.tsx` (after verifying OTP).
- The mobile app's reset logic (in `mobile/src/components/settings-sheet.tsx`) already attempts to call these clear functions, so defining them will resolve the missing implementation.

## Testing Decisions

- The testing seam will be local manual verification.
- We will test the web flow by monitoring `localStorage` through devtools during the onboarding and OTP flows.
- We will test the mobile flow by logging or using a debugger to verify `AsyncStorage` during onboarding and OTP.
- Test that the edit pencil icon appears successfully after onboarding and navigating to the timetable.
- Test that the edit pencil icon disappears successfully after resetting the timetable.

## Out of Scope

- Introducing a global state manager (like Zustand) to replace the current direct storage usage.
- Refactoring the entire API layer.
- Changing the layout or UI of the timetable or onboarding flow.

## Further Notes

- `active-academic-year` will be populated directly from the `academic_year` field of the `RollNumberMappingOut` response.
