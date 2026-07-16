# 1. Timetable Upload Scope

Date: 2026-07-16

## Status

Accepted

## Context

The current Excel upload pipeline for timetables replaces all existing data in the database, indiscriminately wiping sessions across all years and sections. This creates a data loss issue when an admin only wants to update a specific academic year or a specific section.

## Decision

We are introducing the concept of a **Timetable Upload Scope** with two distinct levels:
1. **Academic Year Scope (Full)**: Replaces all sections for a specific academic year. The system will delete all class sessions belonging to sections in that year before inserting the newly parsed Excel data.
2. **Section-wise Scope**: Replaces only the specific section(s) found in the Excel upload. The system will delete class sessions only for those specific sections.

The `admin-webapp` UI will be updated to allow admins to select this scope during the upload process, and the `backend` pipeline (`BronzeSnapshot` and Gold layer processing) will strictly adhere to this scope when performing database deletions.

## Consequences

- Admins can safely update a specific year or section without affecting the rest of the university's timetable.
- The backend needs robust logic to handle partial deletions in the Gold pipeline.
- The `BronzeSnapshot` model will need a way to store the selected scope type and scope target (e.g., year number or section IDs).
