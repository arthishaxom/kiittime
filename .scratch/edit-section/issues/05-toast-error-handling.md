# Handle OTP Backend Safeguards via Toast

## Problem
Currently, when a user attempts to send an OTP via the "Link via OTP" button in the Confirm Link Modal, they might be rejected due to backend rate limiting or cooldowns (HTTP 429). The frontend catches this error and sets `otpError`, but this error is only visible *inside* the OTP Input Modal—which never opens if the initial OTP request fails. This leaves the user stuck on the Confirm Link Modal with no feedback on why the request failed.

## Proposed Solution
Instead of only showing errors inline in the OTP modal, we should present global toast notifications for rate limit and server errors so the user is informed regardless of the current modal state. 

1. **Webapp**: Install and configure `sonner`. Use it to show a toast message when `sendOtp` fails.
2. **Mobile App**: Install and configure `sonner-native`. Use it to show a toast message when `sendOtp` fails.
3. Update `handleSendOtp` in `webapp/src/components/SectionSearch.tsx` and `mobile/src/app/select/sections.tsx` to trigger these toasts instead of swallowing the error out of view.

## Notes
- The backend enforces a 60-second cooldown between OTP sends, a max of 5 OTP sends per hour, and lockout thresholds.
- We must ensure we display the API's detailed error message (which includes exactly how long the user must wait) in the toast.
