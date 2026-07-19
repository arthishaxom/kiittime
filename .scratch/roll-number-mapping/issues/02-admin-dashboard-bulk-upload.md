# 02 — Admin Dashboard: Bulk Mappings Upload

**What to build:** A feature in the admin webapp allowing administrators to upload an Excel/CSV file containing Roll Number to Section mappings. The backend processes this file and updates the database, overwriting previous mappings for the selected academic year.

**Blocked by:** 01 — Database Schema & Roll Number Lookup API

**Status:** completed

- [x] Implement `POST /api/admin/roll-mappings/upload` endpoint in FastAPI.
- [x] Endpoint must parse `.csv` or `.xlsx` files and bulk upsert `RollNumberMapping` records.
- [x] Endpoint must allow scoping by academic year (deleting old mappings for that year).
- [x] Add file upload React component in `admin-webapp` dashboard.
- [x] Connect admin UI to the new API endpoint and display success/error states.
