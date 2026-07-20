# 10 — Multi-sheet Excel Roll Mappings

**What to build:** Support selecting a specific sheet from Excel files for roll mappings, mirroring the timetable upload pattern.

**Blocked by:** 03 — Admin Dashboard: Explicit Column Mapping for Bulk Upload

**Status: completed**

- [x] Update `POST /admin/roll-mappings/inspect` in FastAPI:
  - Accept an optional `sheet_name: str | None = Form(None)` form parameter.
  - For Excel files: if `sheet_name` is omitted, return `{"sheet_names": [...]}`. If `sheet_name` is provided, parse that sheet and return `{"columns": [...]}`.
  - For CSV files: ignore `sheet_name` and return `{"columns": [...]}`.
- [x] Update `POST /admin/roll-mappings/upload` in FastAPI:
  - Accept an optional `sheet_name: str | None = Form(None)` form parameter.
  - If the file is Excel, parse the specified sheet. If CSV, ignore it.
- [x] Update `admin-webapp`'s upload logic on the Roll Mappings tab:
  - On file select: if it is Excel, call `/admin/roll-mappings/inspect` and show the "Sheet" selection dropdown when `sheet_names` are returned.
  - On sheet selection: call `/admin/roll-mappings/inspect` passing the selected `sheet_name` to fetch the columns, then display the column mapping dropdowns.
  - On upload: pass the selected `sheet_name` in the payload.
- [x] Add unit/integration tests to verify multi-sheet inspecting and uploading.
