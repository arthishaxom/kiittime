# 02 — Backend: announcements API endpoints

**What to build:** HTTP surface over the ticket 01 DAO: one public read endpoint and two admin-gated write endpoints, plus request/response schemas with length validation.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] `AnnouncementOut`/`CreateAnnouncementRequest`/`ClearAnnouncementResponse` schemas added to `backend/src/backend/api/schemas.py` with the specified length limits
- [x] `GET /announcements/current` added in a new `backend/src/backend/api/routers/announcements.py` — no auth, `response_model=AnnouncementOut | None`, returns `null` when none is active (FastAPI serializes the DAO's `None` directly; matches this codebase's existing convention of no custom null-handling for "nothing found")
- [x] `POST /admin/announcements` added to `admin.py`, gated by `Depends(get_current_admin)`, commits, returns the new announcement
- [x] `POST /admin/announcements/clear` added to the same router, same auth gate, returns `{"status": "cleared"}`
- [x] New `announcements` router registered in `main.py`
- [x] Over-length fields rejected with `422` by Pydantic `Field(max_length=...)` — confirmed live via Swagger UI (`/docs`)
- [x] Manual verification against a running backend with a real DB — done via Swagger UI: create → current reflects it → second create supersedes first → clear → current empty → unauthenticated write rejected
