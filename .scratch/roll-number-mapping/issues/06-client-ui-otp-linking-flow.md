# 06 — Client UI: OTP Linking Flow (Mobile & Web)

**What to build:** The front-end UI for both mobile and web that connects to the OTP backend. If a student's roll number isn't found in the system, they can manually pick their sections and securely "link" them to their roll number for future use via a quick email verification modal.

**Blocked by:** 04 — Client UI: Roll Number Onboarding (Mobile & Web), 05 — Backend OTP Infrastructure & Linking API

**Status:** completed

- [x] Create OTP verification modal/screen in `mobile`.
- [x] Create OTP verification modal/screen in `webapp`.
- [x] When a roll number mapping is missing and the user manually selects sections, prompt them to "Link" their roll number.
- [x] On prompt acceptance, trigger `POST /api/auth/otp/send`.
- [x] Allow user to input the 6-digit OTP code and trigger `POST /api/auth/otp/verify`.
- [x] On successful verification, show success toast and route them to their timetable.
