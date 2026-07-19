# 08 — Backend OTP Best Practices (Redis Integration)

**What to build:** Refactor the backend OTP implementation to align with 2026 security and architecture best practices. This involves moving OTP state to Redis, applying rate limiting, and cleaning up the database.

**Blocked by:** 05 — Backend OTP Infrastructure & Linking API

**Status:** completed

- [x] Add Redis dependency (`redis` Python package) and configure connection in backend.
- [x] Refactor OTP generation to use cryptographically secure `secrets.SystemRandom()`.
- [x] Migrate OTP storage from Postgres to Redis with a strict 3-5 minute TTL.
- [x] Store OTPs as salted hashes in Redis, not plain text.
- [x] Implement a 60-second resend cooldown for `POST /api/auth/otp/send`.
- [x] Implement rate limiting on `POST /api/auth/otp/send` (max 5 requests per hour per roll number).
- [x] Implement attempt capping on `POST /api/auth/otp/verify` (max 3 failed verification attempts before invalidating the OTP/locking for a short duration).
- [x] Ensure that requesting a new OTP explicitly invalidates any previously active OTP for that user.
- [x] Generate and apply an Alembic migration to drop the now obsolete `otp_verifications` table from the Postgres schema.
