# Map: Handle Missing Professor Names in Parser

## Issues
- [01-update-schemas.md](./issues/01-update-schemas.md)
- [02-update-parser-logic.md](./issues/02-update-parser-logic.md)

## Decisions so far
- Set `faculty_name` to `None` for 2-line cells.
- Fail fast for 1-line or 4+ line cells.
- Update the database schema to make `faculty_id` nullable in `ClassSession`.
