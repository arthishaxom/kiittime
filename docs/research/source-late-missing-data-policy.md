# Source Late/Missing Data Policy — Primary-Source Research

Date: 2026-09-12
Status: Research note (input to an ADR; no production code)
Scope: A nightly ETL ingests PostHog batch-export Parquet (one folder per day). For `2026-08-05` there is no export folder at all; exports only begin `2026-08-12`. The pipeline must never infer `DAU=0` from a missing export (`unknown != zero`). Questions: (1) PostHog batch-export scheduling/backfill/retention, (2) streaming watermark/allowed-lateness semantics, (3) explicit empty vs unknown vs failed markers in analytics platforms, (4) retry-window/SLA/expiry conventions, (5) zero-vs-unknown best practice.

## Summary

Every primary source converges on the same rule: **absence of data is not evidence of zero.** Streaming engines make this explicit by dropping late records after a bound (and never back-filling the result), and analytics metadata formats (Iceberg, Delta) only let you distinguish "empty" from "unknown" because a *committed snapshot/transaction log entry* is the authority that the interval was processed. PostHog is the opposite of authoritative-empty: its own docs state that when no data matches a batch period the run reports `Completed` and **creates no output object at all** ("finishes early as there is no data matching specified filters"). So the 2026-08-05 folder's absence is genuinely ambiguous at the source and must be treated as UNKNOWN.

Two further PostHog facts matter for the case:

- Scheduled exports only cover intervals **from export creation forward**. Historical intervals are exported only by an explicit *backfill*, and backfill is explicitly documented as the mechanism for "data from before the batch export was created" (PostHog model docstring).
- Backfill **cannot attest true emptiness**. It adjusts the start date to the earliest available data and, "if the estimation finds no matching data to export, the backfill completes immediately rather than creating empty batch runs." A 0-row backfill for `2026-08-05` therefore conflates "no events happened" with "no data is retained / project did not exist yet" — it proves nothing about zero activity. Retention is plan-bound (1 year free / 7 years paid; enforcement is a server-side `timestamp > now() - toIntervalMonth(retention)` floor), so after the window the interval becomes permanently unknowable.

The defensible policy is a three-state source-interval model — `data` / `empty` (source-attested) / `unknown-or-failed` — where `empty` is only ever set by positive evidence, and a missing object is `unknown` until a retry window expires, after which it is **abandoned and surfaced**, never translated to zero. This matches the vocabulary already in `CONTEXT.md` (Analytics Source Completeness) and the Ops notes of ADR-0007.

## 1. PostHog batch exports: scheduling, backfill, retention, days before the export existed

- https://posthog.com/docs/cdp/batch-exports — Scheduled runs start at the end of the period after creation and cover only forward intervals; historical data requires a backfill; backfill start "may be adjusted depending on when the earliest available data is"; "If the estimation finds no matching data to export, the backfill completes immediately rather than creating empty batch runs"; "If no data is found for a particular batch period, then the batch export run will immediately succeed with a 'Completed' status" (no object written); records are assigned to runs by **ingestion time**, not event timestamp, so late-arriving events land in a later run and an earlier run is never revisited.
- https://posthog.com/docs/cdp/batch-exports#how-do-batch-exports-handle-periods-with-no-data — "When there is no data to export, a batch export may skip attempting to connect to a destination"; the log shows `Batch export will finish early as there is no data matching specified filters`. This is the primary evidence that a missing folder is not a marker of zero.
- https://posthog.com/docs/api/batch-exports-3 — `POST .../runs/:id/retry/` exists; "retrying a run is the same as backfilling one run," so a specific historical day can be re-exported on demand. This is how a genuinely-late or dropped day is repaired.
- https://github.com/PostHog/posthog/blob/4a5e388e/posthog/batch_exports/models.py — `BatchExport` docstring: "Old periods of time can be re-exported by executing a 'backfill', even periods from before the batch export was created." `BatchExportBackfill.adjusted_start_at` records that the actual start was moved because the user requested a date before data exists.
- https://github.com/PostHog/posthog/blob/0622fb80/products/batch_exports/backend/temporal/destinations/s3_batch_export.py — on empty result the S3 workflow logs "Batch export will finish early …" and returns `S3BatchExportResult(records_completed=0, bytes_exported=0)` **without writing any object** (no explicit empty marker).
- https://github.com/PostHog/posthog/blob/723d2a3f/products/batch_exports/backend/temporal/batch_exports.py — empty-period early exit ("no data to export") is treated as success; backfills use `SELECT_FROM_EVENTS_VIEW_BACKFILL`; failure-threshold logic can auto-pause exports and cancel running backfills.
- https://posthog.com/docs/cdp/batch-exports/s3 — S3-compatible (incl. Cloudflare R2); key prefix supports date variables (`{year}-{month}-{day}_{table}/`); Parquet is written directly by PostHog; a `manifest.json` is emitted only when max file size splits output. Note: the manifest lists files for a *successful run*, and is not emitted for a zero-row period — so it cannot serve as an empty marker either.
- https://posthog.com/pricing — Event retention is plan-bound: 1 year on free, 7 years on paid.
- https://github.com/PostHog/posthog.com/issues/2667 — Pricing FAQ (quoted): "Data in PostHog Cloud is retained for 7 years - after 1 year, data is moved into cold storage so queries may run more slowly."
- https://github.com/PostHog/posthog/pull/64111 — Retention is enforced in the HogQL printer as an unbypassable floor `timestamp > now() - toIntervalMonth(retention)`; `Team.event_retention_months` defaults to 84 months. Practical consequence: once an interval is outside retention, no query/backfill can ever prove it empty.

**Conclusion for 2026-08-05:** PostHog's scheduled export began later, so the day was never scheduled. A backfill is the only repair path, but a 0-row/absent backfill cannot distinguish truly-zero from out-of-retention or pre-project. The day is `unknown` unless positive evidence (source-attested row count within retention) says otherwise.

## 2. Streaming watermark / allowed-lateness semantics

- https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/ — "By default, late elements are dropped when the watermark is past the end of the window." `allowedLateness` bounds how long state is kept; once it expires "Flink removes the window and deletes its state." Late data can be routed to a **side output** via `sideOutputLateData(...)`; late-but-not-dropped elements can trigger late firings.
- https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/streaming_analytics/ — "By default the allowed lateness is 0. In other words, elements behind the watermark are dropped (or sent to the side output)."
- https://beam.apache.org/documentation/basics/ — "A window has a maximum timestamp. When the watermark exceeds the maximum timestamp plus the user-specified allowed lateness, the window is expired. All data related to an expired window might be discarded at any time." Default global window "discards late data."
- https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/windowing/Window.html — Elements later than allowed lateness "will be dropped"; `ClosingBehavior.FIRE_IF_NON_EMPTY` governs whether a final pane is emitted for empty windows. Beam requires an explicit `withAllowedLateness` when a custom trigger is set, i.e. the lateness bound is mandatory, not implicit.
- https://docs.confluent.io/platform/current/streams/concepts.html — Grace period controls how long a window waits for out-of-order data; "If a record arrives after the grace period … the record is discarded and isn't processed in that window." Late records are dropped but measurable via `record-lateness-*` metrics; grace period "supersedes retention time."
- https://kafka.apache.org/33/streams/upgrade-guide/ (KIP-633) — The old implicit 24-hour grace period was dropped; callers must choose `…AndGrace` or `…WithNoGrace`, making the lateness bound explicit.
- https://spark.apache.org/docs/3.5.9/structured-streaming-programming-guide.html — Watermark threshold: data later than the threshold "start getting dropped"; crucially, "the guarantee is strict only in one direction. Data delayed by more than 2 hours is not guaranteed to be dropped; it may or may not get aggregated. More delayed is the data, less likely is the engine going to process it." This non-determinism is the formal reason dropped/absent data must never be reported as a definite zero.

**Takeaway:** Every engine bounds lateness, then drops (or side-outputs) late data; none retroactively rewrites the aggregate. A pipeline that must be correct for a daily source should therefore bound how long it waits, then explicitly mark the interval rather than emit a silent zero.

## 3. Marking an interval EMPTY vs UNKNOWN vs FAILED

- https://hadoop.apache.org/docs/stable/hadoop-mapreduce-client/hadoop-mapreduce-client-core/manifest_committer_protocol.html — Hadoop's output committer writes "a 0-byte `_SUCCESS` file … iff `mapreduce.fileoutputcommitter.marksuccessfuljobs` is true." The marker is an explicit "this directory is complete" token, independent of whether any rows were written.
- https://github.com/apache/spark/pull/47439 (SPARK-44884) — Downstream pipelines "are configured to use success marker as a token of completion of spark processing and to trigger downstream flows." Confirms the pattern: completion evidence is separate from row presence.
- https://iceberg.apache.org/spec/ — A snapshot "represents the state of a table at some time and is used to access the complete set of data files"; the data of a snapshot is the union of live manifest files. Therefore: **snapshot exists + no file for the partition = authoritative empty; no snapshot at all = unknown.** The absence of a data file is only meaningful once a commit/snapshot establishes that the interval was processed.
- https://github.com/delta-io/delta/blob/master/PROTOCOL.md — The transaction log is the source of truth; state is derived by replaying `add`/`remove` actions; `remove` actions act as *tombstones* retained for VACUUM. Same principle: a committed transaction is what makes "no files for this partition" mean zero; no commit means unknown.
- https://github.com/dagster-io/dagster/blob/master/python_modules/dagster/dagster/_core/definitions/asset_checks/asset_check_factories/freshness_checks/time_partition.py — Dagster's partition freshness check emits `any_records_exist_for_asset` metadata "to distinguish between the case where the asset has never been observed/materialized, and the case where this partition in particular is missing." This is a direct, reusable distinction between never-seen (unknown) and missing-partition.
- https://docs.getdbt.com/reference/resource-properties/freshness — dbt freshness is a `max(loaded_at)` vs `now()` comparison with `warn_after`/`error_after`; it has no notion of an attestably-empty interval.
- https://github.com/dbt-labs/dbt-core/issues/2428 — dbt maintainers confirm an empty source table returns `ERROR STALE`, indistinguishable from staleness; users are advised to override `collect_freshness` or write a custom `not_empty` test. Documents the gap the industry has not standardized away.
- https://opentelemetry.io/docs/specs/otel/metrics/data-model/ — The Metrics Data Model defines a "No recorded value" flag for "explicitly missing data in a series"; a previously-present timeseries "SHOULD NOT be returned in queries after such an indicator," and all other fields are ignored. Missing is a state, not a value.
- https://prometheus.io/docs/prometheus/latest/querying/basics/#staleness — When a series stops being exported it "will be marked as stale"; a query after staleness "returns no value for that time series" (not zero). Stale series disappear from graphs.

**Takeaway:** There is no universal "empty partition" sentinel; the robust pattern is a committed manifest/log that records completion, plus an explicit tri-state. PostHog provides neither an empty marker nor a snapshot, so the pipeline must supply the tri-state itself.

## 4. Retry-window / SLA / expiry conventions

- https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/sensors.html — A sensor waits then succeeds, or "fails so that you can be alerted through the usual mechanisms." `timeout` is the max time to succeed (measured from first attempt); `soft_fail=True` marks it `SKIPPED` instead of `FAILED`; `poke` vs `reschedule` is a resource/latency trade-off. This is the canonical "wait bounded time, then make the miss visible" primitive.
- https://airflow.apache.org/docs/apache-airflow/stable/howto/deadline-alerts.html and https://airflow.apache.org/docs/apache-airflow/stable/howto/sla-to-deadlines.html — Airflow 3 removed SLA; Deadlines compute `DeadlineReference + interval` and fire a notifier/callback "immediately" (within `scheduler_heartbeat_sec`), rather than waiting for the DAG to finish. Deadline-based, callback-driven expiry is the modern Airflow recommendation.
- https://docs.getdbt.com/reference/resource-properties/freshness — Two-stage policy: `warn_after` then `error_after`. The warn stage is exactly the "keep retrying but raise visibility" band; `error_after` is the abandon/alert boundary.
- https://docs.dagster.io/guides/observe/asset-freshness-policies — `FreshnessPolicy.cron(deadline_cron, lower_bound_delta)`: an asset is fresh if it materializes within the recurring window; "If the asset has not materialized in the window after the deadline passes, it will fail freshness until it materializes again." Expiry is a first-class, queryable state that persists.
- https://github.com/delta-io/delta/blob/master/PROTOCOL.md — Removed files are kept as tombstones "until it has expired"; a tombstone expiry threshold lets readers clean up while preserving an audit trail. The pattern of an explicit, time-boxed tombstone (not silent deletion) maps directly to "abandoned source interval."
- (supporting) https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/ and https://docs.confluent.io/platform/current/streams/concepts.html — Both delete the state/stop accepting records once the bound expires; the bound is what makes the miss explicit.

**Takeaway:** Standard practice is a two-threshold policy (warn, then error/abandon), with deadlines that fire callbacks and leave a persistent, queryable status. There is no standard *duration*; it is derived from observed source lateness. For PostHog daily exports, a bound of a few days is generous relative to observed ingestion delays, and the `warn` threshold should precede `error`.

## 5. Zero-events vs "we don't know" in event pipelines

- https://opentelemetry.io/docs/specs/otel/metrics/data-model/ — "No recorded value" flag exists specifically so a previously-present series can go explicitly missing; consumers must not return a numeric value for it. The data model treats `0` and `missing` as different types of fact.
- https://prometheus.io/docs/prometheus/latest/querying/basics/#staleness — Stale series are excluded from query results rather than reported as zero; a separate staleness signal is stored. This is the operational template for "unknown, not zero."
- https://spark.apache.org/docs/3.5.9/structured-streaming-programming-guide.html — "Data delayed by more than 2 hours is not guaranteed to be dropped; it may or may not get aggregated." A correct consumer cannot assert a final zero for an interval whose late arrivals were not deterministically handled.
- https://posthog.com/docs/cdp/batch-exports — Because a zero-row PostHog period produces a `Completed` run with **no output object**, there is no source-side artifact that distinguishes "no events" from "no data delivered." Any pipeline rule that maps missing object → 0 would produce false DAU zeros. This is the strongest single citation for the project's stated invariant.
- https://github.com/dbt-labs/dbt-core/issues/2428 — Even mature tooling (dbt) currently conflates empty and stale, and maintainers acknowledge an empty table is "not inherently wrong" but still surfaces as an error. Confirms there is no off-the-shelf answer and the distinction must be modeled explicitly.
- https://iceberg.apache.org/spec/ and https://github.com/delta-io/delta/blob/master/PROTOCOL.md — The only reliable way to assert zero is a committed snapshot/transaction that covers the interval; without that commit, zero is unknowable.

**Takeaway:** Model completeness as an explicit enum on the interval and gate all aggregation on it. `dau=0` is emitted only for an interval whose source has positively attested zero rows; every other absent interval is `unknown` (or `failed`), and the serving layer surfaces staleness instead of zero.

## Recommended policy options for our case

### Option A — Positive-evidence `empty`, else permanent `unknown`; attempt backfill
- On a missing PostHog object, first attempt a PostHog backfill for the date (docs + `.../runs/:id/retry/`).
- If PostHog/API returns a positive row count within retention → `data` (or `empty` if count = 0 with a source attestation).
- If the date is before the export existed and PostHog reports no retained/available data → `unknown` **permanently**; never `empty`. Exclude from DAU and surface the gap on the dashboard.
- Trade-offs: Strongest correctness and matches the invariant; but no automated repair for `2026-08-05` if it is out of retention, and dashboards carry a visible hole. Requires wiring the PostHog API/backfill into the control flow.

### Option B — Time-boxed pending → abandoned (tombstone), with two thresholds
- Statuses: `data` / `empty` / `pending` / `failed` / `abandoned`.
- A missing object is `pending` and retried each nightly run. After `warn_after` (e.g. 2 days) alert; after `error_after` (e.g. 7 days) transition to `abandoned` (a tombstone row), emit an operator alert, and stop retrying until an override or a successful backfill.
- `abandoned` is surfaced as `stale`/gap and is **never** rendered as zero. Backfill/retry can still promote it to `data`/`empty` later (Delta tombstone analogy).
- Trade-offs: Bounds retries and gives a clear, auditable terminal state; needs a chosen window (not in our control) and risks abandoning a genuinely-late day if the window is too short. Additive to ADR-0007's `pending`/`failed`.

### Option C — Explicit operator override only (`POSTHOG_EMPTY_DATES`), absence stays `unknown`
- Keep ADR-0007's existing config: only a human-asserted date is `empty`; any absent object with no override is `pending` until an explicit operator decision, then `unknown`/`abandoned`.
- No automatic `empty` from any heuristic.
- Trade-offs: Minimal code change and fully auditable; but operationally manual, and an unattended missing day stays `pending` indefinitely unless a follow-up automation ages it out (would need to compose with B).

### Option D — Trust PostHog run metadata as the completeness authority
- Use PostHog's batch-run status/`records_total_count`/`records_completed` (and API count fallback already noted in ADR-0007) to declare the interval `empty` when a run exists and reports zero.
- Trade-offs: Clean when a run exists. It does **not** solve `2026-08-05` at all — no run was ever scheduled, so there is no metadata to trust. Should be the *positive-evidence* path inside A/B, not a standalone policy.

**Recommendation:** Combine **A** (positive-evidence `empty`, backfill first) with **B** (time-boxed `pending → abandoned` tombstone and alerts). Never derive `empty` from object absence. For `2026-08-05` specifically: mark UNKNOWN, attempt backfill once, and if PostHog cannot produce retained data, tombstone it as an acknowledged gap rather than a zero.
