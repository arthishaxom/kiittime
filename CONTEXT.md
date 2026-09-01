# Domain Context

## Glossary

- **Academic Year**: The integer year of study (e.g., 1, 2, 3, 4).
- **Section**: A specific class cohort (e.g., CS1, M1).
- **Timetable Upload Scope**: The strict boundary used to determine which old timetable data should be deleted and replaced during an Excel import.
- **Announcement**: A single, admin-authored notice (title + body + optional link) shown to students on app open. At most one is active at a time; publishing a new one is an immutable new row, not an edit. See [ADR-0002](docs/adr/0002-announcements.md).
- **Analytics Source of Truth**: The durable analytics record from which analytical data can be rebuilt. For KIITTime, this is the R2 lake data.
- **Analytics Compute**: The engine that reads analytical data and performs transformations or queries. For KIITTime, this is DuckDB running through MotherDuck.
- **Analytics API**: The authenticated FastAPI boundary that validates dashboard requests and returns analytics results. It is not the analytics compute engine.
- **Gold Analytics Data**: Persisted, business-ready aggregates produced from analytical inputs for dashboard queries.
- **Data Freshness**: The age of the newest successfully processed analytics date visible to dashboard users.
