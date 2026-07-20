---
title: "Implement Additive Uploads and Clear Mappings for Roll Mappings"
status: "done"
assignee: "backend"
---

# Implement Additive Uploads and Clear Mappings for Roll Mappings

## Context
When uploading roll mappings, admins may upload core sections first, followed by elective sections in separate files. A naive "delete and replace" approach overwrites the core section mappings when the elective mapping file is uploaded. We need to implement an additive (Upsert/Merge) upload architecture so multiple uploads correctly accumulate mappings for a student.

## Requirements

1. **Unique Constraint in Database:**
   - Update the `RollNumberMapping` model to include a unique constraint on the combination of `(roll_no, section_id, academic_year)`.
   - This ensures exact duplicate uploads do not result in duplicated data rows.

2. **Additive Upload Logic (Upsert/Merge):**
   - Modify the CSV/XLSX upload processing logic in the backend.
   - When inserting mappings from the uploaded file, use an `INSERT ... ON CONFLICT DO NOTHING` (or ORM equivalent) approach.
   - The upload must NOT delete existing mappings for the academic year or sections. It should purely append new mappings and skip exact duplicates.

3. **Admin "Clear Mappings" Functionality:**
   - Add a new API endpoint `DELETE /admin/roll-mappings/{academic_year}` to delete all roll mappings for a specified academic year.
   - Add a "Clear Mappings" button in the Admin Web App UI, placed near the upload component.
   - Clicking the button should prompt for confirmation and then call the new delete endpoint for the selected academic year, providing administrators a way to reset mappings for a new semester.
