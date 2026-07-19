# 05 — Backend OTP Infrastructure & Linking API

**What to build:** The backend email delivery adapter and the API endpoints required to authenticate a student via OTP sent to their KIIT student email. This allows students to securely link their roll number to specific sections if the admin hasn't uploaded them yet.

**Blocked by:** 01 — Database Schema & Roll Number Lookup API

**Status:** ready-for-agent

- [ ] Implement generic `EmailProvider` adapter interface.
- [ ] Implement concrete Resend email adapter.
- [ ] Create `POST /api/auth/otp/send` endpoint.
- [ ] The send endpoint MUST derive the email address as `[roll_no]@kiit.ac.in` and store the OTP temporarily.
- [ ] Create `POST /api/auth/otp/verify` endpoint.
- [ ] The verify endpoint MUST validate the OTP and permanently create the `RollNumberMapping` in the database.
- [ ] Add unit tests for the email derivation and OTP verification logic.
