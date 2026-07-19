# Edit Section Flow

## Overview
When a user finds a timetable using their roll number, they are currently unable to change the section associated with that roll number if it is incorrect. This feature allows users to edit the section linked to a roll number by reusing the existing Section Selection and OTP verification flow.

## User Flow
1. **View Timetable**: User searches for a timetable by roll number and views it.
2. **Trigger Edit**: An "Edit" button (or pencil icon) is displayed next to the section name at the top of the timetable view.
3. **Navigate**: Tapping the "Edit" button stores the current roll number (e.g., in `temp_linking_roll_no`) and navigates the user to the existing Section Selection screen (`/select/sections`).
4. **Select & Verify**: The user selects their new section(s) and clicks "Done". This triggers the existing OTP confirmation modal.
5. **OTP Verification**: The user enters the OTP sent to their email. Upon successful verification, the database is permanently updated with the new section, and the user is redirected back to the updated timetable.

## Versioning
Since this introduces new user-facing functionality, a **minor version bump** (`pnpm version minor`) must be performed once for both the `mobile` and `webapp` packages at the end of the implementation.

## Technical Details
- Reuses the existing OTP logic in `mobile/src/app/select/sections.tsx` and `webapp/src/components/SectionSearch.tsx`.
- Requires updating the Timetable view to show the Edit button when a roll number is active.
- **Data Retention Strategy**: Uses Slowly Changing Dimension (SCD) Type 1 for roll number mapping updates. The backend `verify_otp` endpoint must delete all existing mappings for the target roll number (across all academic years) before inserting the new mapped sections, ensuring the database only reflects the student's current state.
- **Error Handling**: Implement global toast notifications (`sonner` for webapp, `sonner-native` for mobile) to surface backend OTP safeguards (e.g. rate-limiting, cooldowns) to users who are waiting on the Confirm Link Modal.
