# 03 — Admin Dashboard: Explicit Column Mapping for Bulk Upload

**What to build:** An enhancement to the bulk roll number mapping upload feature that allows administrators to explicitly specify the exact column names for "Roll Number" and "Section" from their Excel/CSV file. 

**Blocked by:** 02 — Admin Dashboard: Bulk Mappings Upload

**Status:** done

- [x] Update `POST /api/admin/roll-mappings/upload` in FastAPI to accept optional `roll_col_name` and `sec_col_name` form fields.
- [x] If explicit column names are provided, the backend must use these exact columns to parse the file instead of relying on the ambiguous auto-detect fallback.
- [x] Update the `admin-webapp` upload component to add two new optional text inputs: "Roll Number Column Name" and "Section Column Name".
- [x] Pass these new fields in the `FormData` when submitting the file to the backend.
- [x] Add backend unit tests to verify that explicit column mapping overrides auto-detection and works correctly.
