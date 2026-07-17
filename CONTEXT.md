# Domain Context

## Glossary

- **Academic Year**: The integer year of study (e.g., 1, 2, 3, 4).
- **Section**: A specific class cohort (e.g., CS1, M1).
- **Timetable Upload Scope**: The strict boundary used to determine which old timetable data should be deleted and replaced during an Excel import.
- **Announcement**: A single, admin-authored notice (title + body + optional link) shown to students on app open. At most one is active at a time; publishing a new one is an immutable new row, not an edit. See [ADR-0002](docs/adr/0002-announcements.md).
