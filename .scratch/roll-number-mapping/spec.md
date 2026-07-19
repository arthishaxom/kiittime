---
labels: ["ready-for-agent"]
---

# Roll Number Mapping & OTP Authentication Spec

## Problem Statement

Currently, students must manually select their academic year and section from a dropdown to view their timetable. This process is tedious and error-prone, especially for students who have multiple sections (e.g., a main section plus several elective sections like HPC1). Students often do not know which specific section cohort they fall into, and piecing together a schedule manually leads to confusion and missing classes. Additionally, administrators need a streamlined way to bulk-upload and manage the relationships between student roll numbers and their assigned sections.

## Solution

The primary onboarding and timetable selection flow will be shifted from "Manual Section Selection" to "Roll Number Input". Students will simply enter their unique Roll Number. The backend will look up this roll number against admin-uploaded mappings and automatically fetch the user's complete timetable, aggregating their main section and any electives for the active academic year.

If a student's roll number is missing from the database but timetables exist, they will be prompted to manually link their roll number to a section via an OTP email verification sent exclusively to their `@kiit.ac.in` student email. The system will handle empty-state scenarios (e.g., beginning of a new semester when the database is cleared) gracefully by alerting the student rather than sending them down dead-end flows.

## User Stories

1. As a student, I want to enter my roll number as the primary way to access my timetable, so that I don't have to guess or manually search for my assigned sections.
2. As a student with electives, I want the system to automatically combine my main section and elective timetables based on my roll number, so that I have a single, unified view of my classes.
3. As a student entering a new semester where the admin hasn't uploaded timetables yet, I want to see a clear error message stating "No timetables uploaded yet", so that I don't waste time trying to verify my email for an empty database.
4. As a student whose roll number is not in the system yet, I want the option to manually link my roll number to my sections via OTP, so that I am not blocked from using the app while waiting for an admin upload.
5. As a student using the OTP flow, I want the system to automatically send the OTP to `[my-roll-number]@kiit.ac.in`, so that I don't have to manually type my email and security is maintained.
6. As a student whose roll number is missing and who cannot use the OTP flow, I want a fallback option to manually select my section and year, so that I can still view the schedule.
7. As an admin, I want to upload an Excel or CSV file mapping roll numbers to sections for a specific academic year, so that I can bulk-enroll students into their correct timetables.
8. As an admin, I want to easily clear or overwrite roll number mappings at the end of an academic year, so that the system stays clean and accurate for the next semester.

## Implementation Decisions

- **Branching**: This feature will be implemented in a dedicated branch (`feat/roll-number-mapping-and-auth`), completely separate from the planned Hugeicons migration.
- **Database Schema**: A new `RollNumberMapping` model will be introduced in the backend (`backend/src/backend/db/models.py`). It will function as a one-to-many relationship tracking `roll_no`, `section_id` (foreign key), and `academic_year`.
- **Admin Upload Module**: The admin webapp will be updated to include an upload component specifically for CSV/XLSX files. It will include fields for the admin to explicitly specify the column names for "Roll Number" and "Section", avoiding auto-detection ambiguities.
- **OTP Email Infrastructure**: An agnostic email provider adapter pattern will be implemented. The initial concrete implementation will use the Resend API to send OTP emails.
- **Email Derivation**: The system will explicitly derive the target email address from the provided roll number (e.g., `2105123@kiit.ac.in`) to prevent malicious linking of other students' roll numbers.
- **Empty State Logic**: Before prompting a user to link their roll number via OTP, the backend will verify if *any* sections exist in the database for the active semester. If none exist, the OTP flow is bypassed in favor of a global empty state warning.
- **Mobile UI Flow**: The mobile app onboarding will be restructured. The default view will be a Roll Number text input. Manual section selection will be demoted to a fallback button beneath the primary input.

## Testing Decisions

- **Testing Philosophy**: Tests should focus on external behaviors and API contracts, avoiding implementation details like internal service function calls.
- **Backend API Seam**: The FastAPI endpoints (e.g., `GET /api/roll-numbers/{roll_no}`) will be tested directly using a mock database to simulate various states (Empty DB, Roll Number Found, Roll Number Missing but DB populated).
- **Email Service Seam**: The email service adapter will be unit-tested using a mocked Resend client to verify that the OTP email address is derived and constructed correctly without sending actual emails.
- **Frontend UI Seam**: The React Native mobile app's navigation and state transitions will be tested by mocking the backend API responses. This will verify that users are routed to the timetable, the OTP flow, or the empty state warning appropriately.
- **Admin Upload Seam**: The file upload endpoint will be tested by passing mocked CSV/XLSX file payloads and asserting that the `RollNumberMapping` records are correctly created or updated in the database.

## Out of Scope

- Migrating existing Lucide icons to Hugeicons (this will be handled in a separate branch/epic).
- Modifying the actual timetable data structure or how classes are rendered.
- Adding departments other than those currently supported by the Excel sheet format.

## Further Notes

- It is crucial that the admin dashboard mapping upload can handle partial updates without wiping the entire academic year, but also provides a way to bulk-delete when a semester ends.
