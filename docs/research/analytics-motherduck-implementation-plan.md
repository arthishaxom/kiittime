# Analytics Serving Implementation Plan

Status: superseded by ADR-0007; retained as design history.

## Current plan: PostgreSQL serving snapshot

- Keep R2 as the Analytics Source of Truth and preserve the existing Bronze → Silver → Gold ETL.
- Backfill the three Gold datasets into an `analytics` schema in the existing Aiven PostgreSQL database.
- Add a nightly Prefect sync that upserts new/reprocessed dates and publishes metadata atomically.
- Verify PostHog source completeness so a missing export is not mistaken for zero DAU.
- Serve the consolidated `/admin/analytics/dashboard` endpoint from PostgreSQL with bounded date filters.
- Keep the local R2 reader only as a temporary rollback path during cutover.

Pending or failed source delivery leaves the previous complete PostgreSQL snapshot in place and marks responses `stale=true`; no partial dashboard response is allowed.

## Validation

- Verify the full Gold backfill and row-level parity against R2.
- Test idempotent date reprocessing and atomic failure rollback.
- Test PostHog `data`, `empty`, `pending`, and `failed` states.
- Measure PostgreSQL query latency and concurrency within Aiven Free's connection limit.
- Verify the local R2 rollback reader and R2 rebuild/backfill path.

## Deferred

- MotherDuck dashboard serving.
- MotherDuck Bronze → Silver → Gold computation.
- Redis/result caching.
- Direct browser access to MotherDuck.
