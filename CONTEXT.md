# Domain Context

## Glossary

- **Academic Year**: The integer year of study (e.g., 1, 2, 3, 4).
- **Section**: A specific class cohort (e.g., CS1, M1).
- **Timetable Upload Scope**: The strict boundary used to determine which old timetable data should be deleted and replaced during an Excel import.
- **Announcement**: A single, admin-authored notice (title + body + optional link) shown to students on app open. At most one is active at a time; publishing a new one is an immutable new row, not an edit. See [ADR-0002](docs/adr/0002-announcements.md).
- **Analytics Source of Truth**: The durable analytics record from which analytical data can be rebuilt. For KIITTime, this is the R2 lake data.
- **Analytics Compute**: The engine that reads analytical data and performs transformations or queries. For KIITTime's nightly pipeline, this is DuckDB; it is not part of the dashboard request path.
- **Analytics API**: The authenticated FastAPI boundary that validates dashboard requests and returns analytics results. It is not the analytics compute engine.
- **Gold Analytics Data**: Persisted, business-ready aggregates produced from analytical inputs for dashboard queries.
- **Analytics Serving Snapshot**: A complete, read-optimized copy of Gold Analytics Data used to serve dashboard requests. It is derived from, but is not, the Analytics Source of Truth.
- **Analytics Source Completeness**: The state of a source interval, distinguishing confirmed data, confirmed no-event activity, pending delivery, and failure.
- **Data Freshness**: The age of the newest analytics date included in the current Analytics Serving Snapshot.
