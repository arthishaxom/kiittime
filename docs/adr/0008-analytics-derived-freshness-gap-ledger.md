# 8. Analytics Control State: Derived Freshness + Postgres Gap Ledger

Date: 2026-09-12

## Status

Accepted — supersedes the serving freshness-metadata contract of [ADR-0007](0007-postgresql-analytics-serving-snapshot.md) (`sync_metadata`, the `data_as_of`/`synced_at`/`stale`/`503` definitions) and the R2 control-table storage rationale of [ADR-0006](0006-analytics-pipeline.md) §4a. Data collection, Bronze/Silver/Gold storage, transforms, orchestration, and the PostgreSQL serving copy in ADR-0007 remain in force.

## Context

A calendar day with no source export was treated as "still pending" forever. Because the nightly flow processed incomplete dates oldest-first and stopped at the first pending date, one permanently missing day blocked every newer day from being served, and the day was retried indefinitely.

The serving path also carried a single-row `analytics.sync_metadata` (`id=1`) whose `status`/`expected_date` were treated as the read-path freshness contract. Field-by-field review showed the row is either derivable or harmful:

- `data_as_of` is `max` of the served dates; the only added input is a Terminal Gap date, which has no Gold row but must still advance freshness.
- `synced_at` is the serving publication time; no serving row carried a timestamp, so it cannot be derived today.
- `status` was used only to force `stale`; `error_message` was never read.
- `expected_date` is the pipeline's declared target (schedule + clock), not data.

Decisively, a stored publication pointer **masks a dead pipeline**: if the nightly flow stops, `status` stays `published` and `expected_date` freezes at or below `data_as_of`, so the reader reports fresh forever while data ages. Meanwhile PostgreSQL already provides the atomic, race-free publication boundary that the pointer was credited with (a single `publish()` transaction), and the analytics sources are column-disjoint (no KPI requires a cross-source join), so nothing needs a durable per-source cursor for correctness.

## Decision

**A calendar day publishes all-or-nothing.** A terminal PostHog gap leaves a visible hole in every chart for that day, and freshness advances across it. Per-source / per-metric-family independent publish (nullable `dau`, per-panel freshness) is explicitly out of scope; revisit only if permanently-missing days stop being a one-off.

### Control state

- The only durable, bespoke control state is the **Gap Ledger**, `analytics.pipeline_gaps(date, source, reason, decided_at)` with a unique `(date, source)`, written by idempotent upsert in PostgreSQL, in the same `analytics` schema as the serving snapshot. It is a quarantine/exception ledger: one terminal decision per `(partition, source)`. It is the only state that must outlive Prefect's finite run retention.
- Completion is **artifact-derived**: a date is done when it is present in the Analytics Serving Snapshot (Gold) or recorded in the Gap Ledger. Per-stage status is no longer tracked externally.
- The R2 per-stage control object (`_metadata/pipeline_runs.parquet`) is retired to read-only audit after its gap rows are migrated.

### Derived freshness (read path)

- `data_as_of` = `max(max(gold.date), max(pipeline_gaps.date))` — the newest **Accounted-for Date** (published or terminally gapped).
- `synced_at` = `max(published_at)`, a new `published_at timestamptz not null` column on all three serving tables set at upsert from a single `datetime.now(UTC)` per publish.
- `stale = scheduled_target(now) > data_as_of`, where `scheduled_target` is derived from the clock and the deployment's publish hour (02:00 IST, matching `prefect.yaml`), computed in `Asia/Kolkata`. A stored target is not trusted.
- The endpoint returns `503` only when no Gold row exists (no successful snapshot).
- `sync_metadata` is dropped; `mark_pending`/`mark_failed` are removed. Run and error history lives in Prefect.

## Consequences

**Positive:**

- The read path is a pure function of Gold + the Gap Ledger; there is no mutable pointer that can drift from reality or claim freshness after the pipeline has died.
- A missing source day is non-blocking and terminal, and a late arrival reopens it through the normal idempotent reprocess path.
- One PostgreSQL table with an enforced unique key replaces an unguarded whole-object read-modify-write in R2, removing the lost-update race.
- No snapshot pointer is needed for atomicity: the `publish()` transaction already provides it.

**Negative / trade-offs:**

- `stale` becomes clock-derived, so the reader must know the publish hour. The configure value is coupled to the deployment cron and can briefly report `stale=true` while a run is still in flight.
- Gaps that must outlive Prefect's retention require the Gap Ledger; if SLA math, replay, or audit beyond retention is ever needed, an append-only serving-run history must be added (a snapshot pointer is still the wrong answer).
- A new `published_at` migration is required on three serving tables, the reader/serving tests change, and `sync_metadata` is removed from both the analytics writer and the backend read model.
- Reverses ADR-0007's "`data_as_of` identifies the newest included Gold date" and "`sync_metadata` is the read-path freshness contract" statements; ADR-0007 is superseded in part.
