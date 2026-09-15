# ETL Control Table Design Review + Branch Deploy Mechanics

Date: 2026-09-12
Status: Research note (input to a spec + ADR; no production code)
Scope: Continuation of the #143 fix (branch `fix/analytics-pending-date-gap`, committed, not pushed).
Answers three questions: (1) how to deploy the branch without merging to `main`, (2) is the
control-table design correct against industry practice, (3) the exact cause of the stall and
whether that class of bug is avoidable. Also records one defect found *in the fix itself*.

Related: `docs/research/etl-control-state-and-gap-handling.md`,
`docs/research/source-late-missing-data-policy.md`, `docs/adr/0006-analytics-pipeline.md`,
`docs/adr/0007-postgresql-analytics-serving-snapshot.md`, issues #143/#144/#145.

---

## TL;DR

- **Deploy:** the managed work pool clones from GitHub at run time, so the branch must be pushed.
  Branch/`commit_sha` are baked into the deployment at `prefect deploy` time; there is no per-run
  branch override. Cleanest is a **temporary second deployment** with its own `pull` override (or
  `prefect deploy --prefect-file`), leaving the production `nightly-etl` deployment untouched.
- **Control table:** the *model* (per-`(date, source, stage)` rows + an explicit terminal gap
  state) is industry-standard. The *storage* (unprotected read-modify-write of one mutable Parquet
  object in R2, no CAS, no enforced unique key) is the classic lost-update anti-pattern. Industry
  either uses conditional writes (S3/R2 `If-Match` ETag), a transactional store (Postgres) with a
  unique key + upsert, or a single-writer lock. Since ADR-0007 already made Postgres a hard serving
  dependency, the "keep it in R2 to decouple from Postgres" rationale is stale.
- **Stall cause:** head-of-line blocking — a flow-control `return` treated one partition's
  not-ready state as a global barrier, and the completeness predicate had no terminal state for a
  genuine gap. Mature orchestrators make blocking opt-in and gaps terminal, so the pattern is
  guarded against by design; any hand-rolled cursor flow can reproduce it.
- **Fix defect:** the auto-abandon path marks `serving=skipped` but never `gold=success`, and the
  predicate still requires `gold=success`. So an abandoned date **stays in `get_pending_dates`
  forever and is re-attempted every night**. The "terminal gap / stop retrying" acceptance
  criterion is not actually met by the current branch.

---

## 1. Deploying the branch without merging to `main`

Fact from Prefect 3.x docs: the `pull` section is stored on the deployment; `git_clone` clones the
given `branch`/`commit_sha` on the **worker at run time**. With the `kiittime-managed` work pool the
worker runs Prefect-side and clones from GitHub, so the branch/commit must exist on the remote —
there is no way to run uncommitted local code through it.

- Branch/`commit_sha` are resolved at `prefect deploy` time (that is when the pull step is written
  into the deployment). The docs note the pull section is templated but not run at deploy time, and
  that block refs are deliberately *not* hydrated then (resolved at runtime for security).
- `git_clone` supports `commit_sha`, e.g. `commit_sha: "{{ $GITHUB_SHA }}"`, as well as `branch`.
  `prefect deploy` has no `--branch`/`--commit-sha` flag (confirmed on installed 3.8.1).
- Deployment-level `pull` overrides the top-level `pull` ("The `build`, `push`, and `pull` sections
  in deployment definitions take precedence over the corresponding sections above them").
- `prefect deploy --prefect-file <path>` (confirmed flag) lets a different yaml be used, so the
  committed `prefect.yaml` can stay on `main`.
- Deployment concurrency limits are now codifiable in yaml: `concurrency_limit: 1` (or the object
  form with `collision_strategy`/`grace_period_seconds`), which is a better home for the D3 stopgap
  than a work-pool limit.

Options, best first:

1. **Temporary branch deployment.** Push the branch; register a distinct deployment (e.g.
   `nightly-etl-branch`) whose `pull.git_clone.branch` is the fix branch. Production `nightly-etl`
   is untouched. `prefect deploy --name nightly-etl-branch` then
   `prefect deployment run 'nightly-etl-flow/nightly-etl-branch'`.
2. **Alternate file.** `prefect deploy --prefect-file prefect.ci.yaml` with the branch override;
   commit nothing; delete the temp deployment after verification.
3. **`commit_sha` pin.** Same as 1/2 but pin the exact SHA for provenance.
4. **Local process work pool.** Point a deployment at a local pool that uses this checkout; the only
   route that avoids a push, at the cost of requiring the machine to stay up with all secrets.

Do **not** flip the production deployment's branch to the feature branch: nightly runs would then
execute unmerged code until reverted. Note #145: any deployment registered via `job_variables`
re-bakes the current secret values.

---

## 2. Control-table audit vs industry

### What is industry-standard

- One control/metadata row per partition (and per source where there are several), carrying a
  status; catch-up of incomplete partitions; a derived watermark. Matches Databricks per-table
  watermark tables, AWS Glue job bookmarks, dbt microbatch bookmarks, Snowflake Streams.
- A four-outcome model: `success`, `failed` (retryable), `pending` (retry with a bound),
  `skipped`/`quarantined`/`abandoned` (terminal gap that counts as complete). Matches Airflow
  `skipped`/`AirflowSkipException`, Dagster partition `missing`/`failed`, Kafka Connect DLQ.

### What is not industry-standard

- **Mutable whole-object read-modify-write with no concurrency control.** `control.py` reads the
  entire Parquet object, builds the next table in memory, then `COPY ... OVERWRITE`s the object.
  Two overlapping runs lose whichever write lands first. Industry solves this with conditional
  writes (S3/R2 `If-Match` ETag CAS, GCS `ifGenerationMatch`), a transactional store + unique key +
  upsert, or `max_concurrency = 1`. Iceberg/Delta stay in object storage but commit via an atomic
  metadata pointer swap with optimistic-concurrency retry — not by rewriting a live data file.
- **Unique `(date, source, stage)` is enforced by application logic, not the store.** A real unique
  constraint/index is the norm.
- **The storage-location rationale is stale.** ADR-0006 §4a chose R2-Parquet to stay "fully
  decoupled" from OLTP Postgres. ADR-0007 then made Aiven Postgres a hard dependency for the
  serving snapshot and already runs `SELECT ... FOR UPDATE` + `ON CONFLICT` there
  (`serving.py`). The decoupling argument no longer holds.
- **Gap records lack `actor`/`decided_at`/`expires_at`.** Only `reason` was added. Terminal
  decisions should be auditable (Delta tombstone retention, DLQ provenance headers).

### Verdict

Model correct; storage is the anti-pattern. The durable target is #144 option **D2**: control state
in `analytics.pipeline_runs` in Postgres, unique `(date, source, stage)`, `INSERT ... ON CONFLICT DO
UPDATE`, `SELECT ... FOR UPDATE SKIP LOCKED` for decisions. R2 can keep an append-only export/audit
copy if wanted, but not as the mutable source of truth.

---

## 3. Root cause of the stall

`nightly_etl_flow` (on `main`/`ef8b949`) iterated incomplete dates oldest-first and, on
`SourceState.PENDING`, called `repository.mark_pending(current_date)` and `return current_date`.
`get_pending_dates` deems a date complete only with `gold=success AND serving=success`. A date whose
source export will never exist (`2026-08-05`; exports only start `2026-08-12`) can never satisfy
that, always sorted first, and the `return` fired before any newer date → `sync_gold_to_postgres`
never ran → empty `analytics.*` → dashboard 503.

Contributing design gaps:

1. `pending` meant both "not yet arrived, retry" and "never coming"; there was no bound or expiry.
2. The completeness predicate had no terminal state for a known gap.
3. `gold=success` was a flag with no Gold row (`flag != artifact`).

Class of bug: **head-of-line blocking / stalled watermark** — one not-ready partition freezes the
global cursor. It is the unbounded form of Airflow's opt-in `depends_on_past`/`wait_for_downstream`,
and the same phenomenon Flink guards with `.withIdleness()` so an idle partition does not hold back
the watermark.

Does it happen in industry? The *failure mode* is well known and actively designed out: partitions
are independent units (Airflow backfill/`max_active_runs`, Dagster one-run-per-partition), blocking
is opt-in, lateness is bounded with expiry (Flink allowed-lateness, dbt `warn_after`/`error_after`,
Dagster `FreshnessPolicy` deadlines, sensor `timeout` + `soft_fail`), and gaps get terminal states.
But any hand-rolled flow with a single global cursor can reproduce it — it is a design bug, not an
exotic one.

---

## 4. Defect in the current fix (found while reviewing)

The auto-abandon branch (`nightly_etl.py`, pending-age > `POSTHOG_PENDING_MAX_DAYS`) records
`serving=skipped` and `continue`s **before the Gold stage runs**. `get_pending_dates` still requires
`gold=success`. Therefore an abandoned date:

- no longer blocks newer dates (the main win — `continue` instead of `return`), but
- is still returned by `get_pending_dates` on every run and re-attempted nightly (PostHog list call
  + `pending`/`skipped` rewrites), so it never becomes terminal and "stop retrying" is not achieved.

`test_skipped_serving_counts_as_complete` only covers `gold=success` + `serving=skipped`, so the gap
is untested. Candidate fixes:

- **(a)** treat `serving=skipped` as complete on its own (normal `serving=success` already implies
  Gold ran), or
- **(b)** mark `gold=skipped` as well when abandoning, or
- **(c)** add a dedicated terminal marker for the date.

(a) is the smallest change consistent with the existing predicate.

---

## 5. Follow-up: is a bespoke control table necessary, and does Postgres get used?

Verified against primary sources (2026-09-12):

- **Managed state is the modern default.** Airflow's TaskInstance table is "the authority and single
  source of truth around what tasks have run and the state they are in"; Dagster persists run/asset
  materialization state in an instance; Prefect's server DB persists flow/task run state; Delta
  `_delta_log` and Iceberg snapshots carry commit-level state; AWS Glue job bookmarks and Snowflake
  Streams track source progress. Sources: Airflow TaskInstance docs; Dagster instance docs; Prefect
  server docs; Delta transaction-log docs; AWS Glue `monitor-continuations`; Snowflake Streams
  intro.
- **Hand-rolled control/watermark tables are a real documented pattern**, but normally a *database
  table*, not a mutable object-store file: Azure Data Factory's official incremental-copy tutorial
  uses a watermark table; a Microsoft reference architecture keeps `Metadata_Watermark` and
  `ChangeDataFeedState`; Meltano/Singer persist `STATE` to a transactional DB (the
  `meltano-state-backend-postgresql`). Sources: MS Learn ADF incremental-copy tutorial; MS Learn
  nonprofit incremental-data-processing; Meltano `state_backends`.
- **Postgres for control state is legitimate and common** — as the transactional store (orchestrator
  metadata DB, Meltano systemdb state backend, Prefect self-hosted which requires Postgres). It is
  *not* common to keep it as a single mutable Parquet object in object storage.
- **The strongest small-team pattern is artifact-derived state + idempotent partition overwrite**
  (functional data engineering): "A pure task should always fully overwrite a partition as its
  output," making reruns safe and completion implicit in the data. Delta `replaceWhere`/dynamic
  partition overwrite and dbt `insert_overwrite`/microbatch implement this. Source: Beauchemin,
  "Functional Data Engineering"; Delta `replaceWhere`; dbt microbatch.
- **Missing/late source partitions are skipped/quarantined, not blockers**, in the tools that model
  it: Delta Live Tables expectations default to `warn` (keep + continue), Databricks documents a
  quarantine pattern, Airflow sensors can `soft_fail` to `SKIPPED`, Dagster sensors raise
  `SkipReason`. Sources: Databricks DLT expectations; Airflow sensors; Dagster sensor source.
- **Prefect state has finite retention** (Cloud Hobby 7 days; Pro 30; OSS vacuum off by default,
  90 days if enabled), so Prefect run state alone is *not* a durable ledger for gaps that must
  outlive a week. `Secret.load()` / deferred block refs resolve at runtime, which is the #145 fix
  path. Sources: Prefect rate-limits (retention), Prefect store-secrets.

**Revised verdict:** the bespoke per-stage control table is **not necessary for execution
correctness**. Idempotent partition overwrite + deriving completion from destination artifacts
covers catch-up; orchestrator-native mapping gives per-date independence. A durable external record
is only justified for **terminal gap decisions that must survive Prefect's retention**, and if kept
it belongs in **Postgres** (or as a small `_gaps` manifest written by an idempotent task), never as
an unguarded mutable R2 Parquet object.

---

## 6. Follow-up: is a singleton `sync_metadata` industry-standard? (cardinality audit)

The reviewer's concern: the examples shown (Databricks `config.watermarks`) are **one row per
source table**, but our `sync_metadata` is a **single row** (`id=1`) and `pipeline_gaps` is **one
row per `(date, source)`**. These are different cardinalities; are they still good practice?

Four cardinalities appear in real systems; do not conflate them:

| Cardinality | Row identity | Nature | Example |
|---|---|---|---|
| per pipeline (singleton) | `id=1` | mutable current-state pointer | Iceberg `current-snapshot-id`; Delta `_last_checkpoint` |
| per source / asset / model | `source_table`, `asset_key`, `model_id` | mutable cursor / watermark | Databricks `watermarks`; Dagster `asset_keys`; Segment `checkpoints_*` |
| per partition / date | `(asset_key, partition)`, `(dag_id, logical_date)` | mutable per-partition state | Airflow `dag_run`; dbt `sources.json`; Snowflake stream offset |
| per run / commit | `run_id`, `snapshot-id`, commit version | append-only history | Dagster `event_logs`; Hightouch `sync_runs`; Fivetran `LOG`; Delta `_delta_log`; Iceberg `snapshot-log` |

**Assessment of our design (one singleton `sync_metadata` + per-`(date, source)` `pipeline_gaps` +
artifact-derived completion):**

- **Consistent with practice:** a "last successful sync / data as of" record is a recognized
  pattern (Hightouch `sync_snapshot`, Segment `checkpoints_*`, Databricks `last_watermark`,
  Iceberg `current-snapshot-id`). A per-`(date, source)` gaps table is the right granularity for
  terminal decisions and doubles as a quarantine/exception table (dbt `store_failures_as`,
  Hightouch `sync_changelog`). Deriving completion from artifacts mirrors how `asset_keys` and
  Iceberg manifests are projections over materialized data.
- **Non-standard parts:**
  1. **Bare global `id=1`.** Industry keys state by the object it describes (per source, asset,
     model, stream, or snapshot). A bare `id=1` means any future serving target collides on the
     same row. Standard equivalent: one row per served artifact/snapshot, keyed.
  2. **No append-only run history alongside the projection.** Every system surveyed keeps both a
     latest-state projection *and* an append-only run/event log (Dagster `asset_keys` +
     `event_logs`; Hightouch `sync_snapshot` + `sync_runs` + `sync_changelog`; Fivetran metadata +
     `LOG`; Delta `_last_checkpoint` + `_delta_log`; Iceberg pointer + `snapshot-log`). A single
     mutable row loses audit, SLA/latency math, replay, and failure forensics; a buggy publish
     silently destroys the only state.
  3. **`status` conflates run outcome with snapshot validity.** "Did the job run?" (per run) and
     "is this snapshot complete/authoritative?" (per snapshot) are different facts.

**Standard equivalent shape:**

```
serving_snapshot(snapshot_id PK, target, data_as_of, expected_date,
                 synced_at, status, source_manifest/checksum, created_at)   -- current-state, keyed
serving_publish_run(run_id PK, snapshot_id FK, started_at, finished_at,
                    status, error, data_as_of, records_published)           -- append-only history
pipeline_gaps(data_date, source, reason, decided_at, run_id FK,
              PRIMARY KEY (data_date, source))                              -- terminal decisions
```

The singleton lookup becomes a view/materialized projection
(`SELECT ... ORDER BY synced_at DESC LIMIT 1`) over `serving_snapshot`, not the system of record.

**Bottom line:** the reviewer is half-right. Per-source/per-object cardinality is the industry norm
for watermarks. A single-row publication-status table is also a known pattern, but it is normally
(a) keyed per artifact/snapshot rather than `id=1`, and (b) paired with append-only run history.
Our per-`(date, source)` gaps table and artifact-derived completion are standard; the non-standard
parts are the global singleton key and the absence of run history.

Primary sources: Databricks watermark/For-each tutorials; Dagster `event_log/schema.py` and
`_core/storage` (`asset_keys`, `event_logs`); dbt `sources.json` / `run_results.json`;
Airflow `dag_run` / `asset_event`; Hightouch warehouse sync logs (`sync_snapshot`, `sync_runs`,
`sync_changelog`); Fivetran platform metadata + `LOG`; Segment reverse-ETL `checkpoints_*`;
Snowflake Streams (`STALE`/`STALE_AFTER`); Iceberg spec (`current-snapshot-id`, `snapshot-log`);
Delta PROTOCOL (`_last_checkpoint`, `_delta_log`).

---

## Sources

- Prefect: `git_clone`/pull mechanics, deployment overrides, `--prefect-file`, `concurrency_limit`,
  `commit_sha` — `/prefecthq/prefect` docs (deployment how-tos, versioning).
- S3/R2 conditional writes (`If-Match`/`If-None-Match`, `412`); GCS `ifGenerationMatch`; Iceberg
  atomic metadata swap; Delta optimistic concurrency — see
  `docs/research/etl-control-state-and-gap-handling.md` for citations.
- Airflow independent runs / `depends_on_past`; Dagster partition status; Flink idle-watermark and
  allowed-lateness; dbt freshness/`warn_after`/`error_after` — same doc.
- PostHog batch-export no-object-on-empty and retention — `docs/research/source-late-missing-data-policy.md`.
