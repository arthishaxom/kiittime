# PostgreSQL Analytics Serving Snapshot

Date: 2026-09-05

## Status

Accepted — supersedes the analytics serving path in ADR-0006.

## Context

KIITTime's admin dashboard serves three small, pre-aggregated Gold datasets. Reading R2 Delta data through MotherDuck on every request adds a remote compute and object-storage dependency to a bounded OLTP-style workload. A read-optimized serving copy in the existing Aiven PostgreSQL service gives FastAPI predictable low-latency queries while R2 remains independently rebuildable.

## Decision

- R2 remains the **Analytics Source of Truth**. The three Gold datasets remain the durable Bronze/Silver/Gold pipeline outputs in R2.
- The nightly Prefect flow performs an initial full backfill and then idempotently syncs complete Gold history and changed dates into an **Analytics Serving Snapshot** in the existing Aiven PostgreSQL database.
- Serving data lives in a dedicated `analytics` schema. It contains only `gold_daily_usage`, `gold_endpoint_health`, `gold_section_trends`, and serving-sync metadata; raw Bronze/Silver events are never copied to PostgreSQL.
- Serving keys are `(date)` for daily usage, `(date, endpoint)` for endpoint health, and `(date, section_name, section_year)` for section trends. Date indexes support the bounded 1–365 day dashboard queries.
- The sync publishes all three datasets and its success metadata in one PostgreSQL transaction. Retries upsert the same keys; a failed transaction leaves the previous complete snapshot intact.
- FastAPI reads the serving snapshot through the consolidated authenticated `/admin/analytics/dashboard` endpoint. `data_as_of` identifies the newest included Gold date; `synced_at` identifies the successful serving publication time; `stale=true` means the latest expected source interval has not been successfully published. If no successful snapshot exists, the endpoint returns `503`.
- MotherDuck is removed from the FastAPI request path. MotherDuck ETL migration is deferred. The existing local R2 reader remains temporarily available as an explicit rollback path during cutover.
- The analytics worker uses a write-capable database credential; FastAPI uses a read-only analytics credential. Credentials remain server-side.

### Source completeness

The pipeline never infers zero activity from an absent PostHog object:

- `data`: a completed PostHog interval has exported rows and the corresponding R2 files are present.
- `empty`: a completed PostHog interval is verified to contain zero rows. The Gold transform records `dau=0` without creating a fake event or Parquet row.
- `pending`: the interval is not confirmed complete, or delivery is still running. The sync does not advance the serving snapshot; the next run retries.
- `failed`: the source or destination failed. The sync does not advance the serving snapshot and emits an operator-visible failure.

PostHog batch-run completion and interval metadata are checked; when the run metadata does not expose a row count, the analytics worker verifies the interval count through the PostHog API. An absent destination object after a source interval with rows is a delivery failure, not an empty day. An Axiom query that authoritatively returns no rows is a valid empty day and is recorded with zero files.

When a source is pending or failed, the API continues serving the previous complete snapshot with `stale=true`; it never publishes a partial mixed-freshness dashboard. A confirmed empty day advances freshness normally and renders zeroes.

## Consequences

- Dashboard requests use the existing PostgreSQL connection path and do not depend on MotherDuck or R2 availability at request time.
- The existing Aiven Free PostgreSQL service is sufficient; the `analytics` schema is a namespace and privilege boundary, not a second database or capacity allocation.
- The database gains a small analytics read model and migration surface. Its Free-tier 1 GB storage, 1 GB RAM, and 20-connection limit remain shared with the application, so connection pools must stay bounded.
- The serving snapshot is intentionally delayed until source completeness is known. This avoids presenting unknown DAU as zero at the cost of temporarily stale dashboards when PostHog delivery is late.
- R2 remains the rebuild and recovery path; deleting or rebuilding the PostgreSQL serving snapshot does not destroy analytics history.
