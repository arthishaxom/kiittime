# 09 — Client UI: OTP Rate Limiting & Cooldowns (Mobile & Web)

**What to build:** Update the frontend UI to gracefully handle the new backend rate limits, resend cooldowns, and lockout mechanisms introduced for OTP security.

**Blocked by:** 06 — Client UI: OTP Linking Flow, 08 — Backend OTP Best Practices

**Status:** completed

- [x] Implement a visual 60-second countdown timer on the "Resend OTP" button in the `mobile` app, disabling the button until it expires.
- [x] Implement a visual 60-second countdown timer on the "Resend OTP" button in the `webapp`, disabling the button until it expires.
- [x] Handle 429 Too Many Requests errors from the backend on the `POST /api/auth/otp/send` endpoint, displaying a user-friendly toast/alert.
- [x] Handle attempt lockout errors (e.g., 403 or 429) from the `POST /api/auth/otp/verify` endpoint if the user exceeds 3 failed attempts, showing an appropriate warning.
