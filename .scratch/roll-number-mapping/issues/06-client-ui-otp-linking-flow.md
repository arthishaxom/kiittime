# 06 — Client UI: OTP Linking Flow (Mobile & Web)

**What to build:** The front-end UI for both mobile and web that connects to the OTP backend. If a student's roll number isn't found in the system, they can manually pick their sections and securely "link" them to their roll number for future use via a quick email verification modal.

**Blocked by:** 04 — Client UI: Roll Number Onboarding (Mobile & Web), 05 — Backend OTP Infrastructure & Linking API

**Status:** ready-for-agent

- [ ] Create OTP verification modal/screen in `mobile`.
- [ ] Create OTP verification modal/screen in `webapp`.
- [ ] When a roll number mapping is missing and the user manually selects sections, prompt them to "Link" their roll number.
- [ ] On prompt acceptance, trigger `POST /api/auth/otp/send`.
- [ ] Allow user to input the 6-digit OTP code and trigger `POST /api/auth/otp/verify`.
- [ ] On successful verification, show success toast and route them to their timetable.
