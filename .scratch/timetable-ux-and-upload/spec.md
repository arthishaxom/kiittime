Status: ready-for-agent

# Spec: Timetable UX Updates and Upload Scope Fix

## Problem Statement

Users are facing a few distinct issues:
1. When selecting a section in the mobile and web applications, there are too many sections to browse easily. The list is currently a flat, unsorted array, making it overwhelming for users who don't know the exact search query.
2. In the timetable view on both frontend apps, the section code/name header is not visually centered.
3. When an admin uploads an Excel timetable, the backend aggressively replaces all class sessions across all sections and years, wiping out data that should not be touched. The current backend implementation has "Full semester", "By department", and "By sections", but "By department" is a forward-looking stub and does not align with the actual data model, which tracks the academic `year` on the `Section` model.

## Solution

1. Improve the section selection UX (`mobile/src/app/select/sections.tsx` and `webapp/src/routes/select/sections.tsx`):
   - **Dynamic Grouping/Faceted Filtering**: Dynamically extract the alphabetical prefix from section names (e.g., extracting "CS" from "CS1") to form groups/departments. Present these groups as horizontal filter chips (e.g., `[All] [CS] [IT] [MECH]`) so users can quickly narrow down the list.
   - **Alphanumeric Sorting**: Sort the section list alphanumerically so that sequences like `CS1, CS2, CS10` are logically ordered.
   - **Search Input**: Maintain the text search for quick retrieval.
2. Center the section name header (e.g., "CS1") in the timetable view for better visual balance (`mobile/src/app/timetable.tsx` and `webapp/src/routes/timetable.tsx`).
3. Refactor the backend upload scope to replace "department" with "year" (Academic Year). The `admin-webapp` review screen will ask for a "Year" (1-4) instead of a "Department", and the backend pipeline will restrict deletions to only the old data within that selected `year`.

## User Stories

1. As a user, I want to filter the long list of sections by their group/prefix (e.g., only seeing "CS" sections) via quick-tap filter chips, so that I don't have to scroll through unrelated departments.
2. As a user, I want the section list to be sorted alphanumerically when I browse, so that I can find my section efficiently.
3. As a user, I want the section name to be centered in the timetable view, so that the layout looks balanced and aesthetically pleasing.
4. As an administrator, I want to upload an Excel timetable and specify that it should only replace a specific "Academic Year" (e.g., 4th year), so that other years' schedules remain untouched.
5. As an administrator, I want to upload an Excel timetable and specify that it should only replace specific "Sections", so that I can safely update a few classes without affecting the rest of the database.

## Implementation Decisions

- **Frontend (Mobile & Webapp) Section Selection**:
  - Dynamically compute unique prefixes using a regex like `/^[A-Z]+/i` over the loaded `sections` list.
  - Add state for `selectedPrefix` (defaulting to "All").
  - Filter the `sections` array by both `search` text AND `selectedPrefix`.
  - Sort the resulting array using `localeCompare(..., { numeric: true })`.
  - Render a horizontal scrolling list of selectable `Badge` components for the prefixes above the main list.
- **Frontend Timetable**: Add centering styling (`items-center` or `text-center`) to the header wrapper.
- **Backend Model & API Schema**: Update `backend.pipeline.scope.UpsertScope` to use `year: int | None = None` instead of `department: str | None = None`. Update API schemas accordingly.
- **Backend Pipeline**: `backend/src/backend/pipeline/gold.py` will query for sections matching the provided `year` instead of `department` and scope the DELETE statement accordingly.
- **Admin Webapp**: In `admin-webapp/src/routes/_authenticated/review.$uploadId.tsx`, change the "By department" scope mode to "By year" and update the input to collect a number.

## Testing Decisions

- **Testing Philosophy**: Tests should cover external behavior.
- **Backend Testing Seam**: `backend/tests/pipeline/test_gold.py`. Modify tests to use a `BronzeSnapshot` with a `year` scope or `section_ids` scope.
- **Frontend Testing Seam**: UI component logic should accurately extract prefixes, filter by the selected chip, and correctly sort alphanumerically.

## Out of Scope

- Modifying the parsing logic of the Excel files (bronze/silver layers) beyond associating the extracted data with the new scope.
- Database schema changes to add an explicit `department` column to the `Section` table (we will compute it dynamically on the frontend for UX purposes instead).

## Further Notes

- ADR `0001-timetable-upload-scope.md` and `CONTEXT.md` have been updated to reflect the new domain terminology.
