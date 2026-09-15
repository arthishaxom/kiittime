# ETL Control State & Gap Handling — Industry Patterns for a Stalled Backfill

**Question:** A nightly batch ETL keys off a Parquet "control table" of `(date, source, stage, status)` rows. A date is complete only when it has `gold=success` **and** `serving=success`. The flow iterates incomplete dates oldest-first and `return`s on the first date whose source export is `pending`. One permanently-missing old date (2026-08-05) therefore blocks every newer date from being served. How does the industry model and solve this?

**TL;DR.** The blocking `return` is a **flow-control bug** that conflates *completeness of a partition* with *ordering of the whole pipeline*. Every production orchestrator surveyed treats partitions/runs as **independent units of work** (Airflow catchup/backfill with `max_active_runs`, Dagster per-partition backfills, Prefect concurrent task runs) and allows a partition to be **failed, skipped, quarantined, or expired** as an explicit terminal state — never "pending forever". Watermarks (`max(event_time)`), bookmarks, and allowed-lateness give a bounded window after which a partition is declared **abandoned** and the watermark advances over it; late data can still be applied idempotently. A `pending` source should be a **non-blocking, retryable condition** for its own date, and a first-class **`skipped`/`excluded`/`abandoned` gap record** (with reason, actor, timestamp, expiry) should satisfy the completeness predicate so downstream serving can proceed. For the single-object control file, use **compare-and-swap conditional writes** (S3/R2 `If-Match` on ETag, GCS `ifGenerationMatch`) or move control state to the transactional store you already have (Postgres) — never an unprotected read-modify-write.

---

## Research Question 1 — How production orchestrators handle one stalled partition while newer ones are ready

### Apache Airflow

- **Catchup and backfill create runs per data interval independently; the scheduler does not stop at a gap unless you configure a serial dependency.**
  - *"If you set `catchup=True` in the Dag, the scheduler will kick off a Dag Run for any data interval that has not been run since the last data interval (or has been cleared). This concept is called Catchup."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dag-run.html
  - *"There are three options for reprocessing behavior: `none` … `failed` … `completed`. … If the latest run is still running or is queued, we do not create another run, no matter the chosen reprocessing behavior."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html
  - *"You can set `max_active_runs` on a backfill and it will control how many Dag runs in the backfill can run concurrently. Backfill `max_active_runs` is applied independently [of] the Dag `max_active_runs` setting."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/backfill.html
  - *"`max_active_runs` defines how many `running` concurrent instances of a Dag there are allowed to be."* — https://airflow.apache.org/docs/apache-airflow/stable/faq.html
  - Config default = 16: *"The maximum number of active DAG runs per DAG. The scheduler will not create more DAG runs if it reaches the limit."* — https://airflow.apache.org/docs/apache-airflow/stable/configurations-ref.html
- **The "one old date blocks everything" behavior is exactly `depends_on_past`/`wait_for_downstream` — and it is opt-in, not the default.**
  - *"You can also say a task can only run if the previous run of the task in the previous Dag Run succeeded. To use this, you just need to set the `depends_on_past` argument on your Task to `True`. Note that if you are running the Dag at the very start of its life … the Task will still run, as there is no previous run to depend on."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html
  - *"`wait_for_downstream=True` will cause a task instance to also wait for all task instances immediately downstream of the previous task instance to succeed."* — https://airflow.apache.org/docs/apache-airflow/2.11.0/tutorial/fundamentals.html
- **A failed/skipped parent can be tolerated by `trigger_rule` rather than aborting the whole graph.**
  - *"`all_done`: all parents are done with their execution … `none_failed`: all parents have not failed … i.e. all parents have succeeded or been skipped."* — https://airflow.apache.org/docs/apache-airflow/1.10.9/concepts.html
  - *"Skipped tasks will cascade through trigger rules `all_success` and `all_failed` but not `all_done`, `one_failed`, `one_success`, `none_failed`, `none_skipped` and `dummy`."* — https://airflow.apache.org/docs/apache-airflow/1.10.9/concepts.html
- **Dynamic task mapping: work is created at runtime from the set of incomplete partitions, so a gap simply yields no task rather than blocking siblings.**
  - *"Dynamic Task Mapping allows a way for a workflow to create a number of tasks at runtime based upon current data … Right before a mapped task is executed the scheduler will create n copies of the task, one for each input."* — https://airflow.apache.org/docs/apache-airflow/stable/authoring-and-scheduling/dynamic-task-mapping.html
  - *"`depends_on_past` … if you set catchup=False … Airflow can backfill the Dag and run copies of it for every day in those previous 3 months, all at once."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html

### Dagster (partitioned assets / backfills)

- **Partitions are independent; one failed partition does not block others, and it can be retried alone.**
  - *"Dagster supports backfills for each partition or a subset of partitions."* — https://docs.dagster.io/guides/build/partitions-and-backfills/backfilling-data
  - *"By default, Dagster launches one run per partition. This provides maximum observability and fault isolation—if one partition fails, others continue independently, and partitions are individually retried."* — https://docs.dagster.io/examples/best-practices/partition-backfill-strategies (table also gives batched `multi_run` and `single_run` tradeoffs)
- **Asset/partition state is queried explicitly, and "missing"/"failed" are addressable conditions.**
  - *"`AutomationCondition.missing` — Target has not been executed … `AutomationCondition.execution_failed` — Target failed to be executed in its latest run."* — https://docs.dagster.io/guides/automate/declarative-automation/automation-condition-reference
  - *"The `AutomationCondition.on_missing` condition will execute a missing asset partition when all upstream partitions of the asset are available."* — https://docs.dagster.io/guides/automate/declarative-automation
  - *"By default, `AutomationCondition.on_missing()` will only update the latest time partition … the condition will not automatically 'catch' up if upstream data is delayed for longer than it takes for a new partition to appear. If desired, this sub-condition can be removed or replaced"* — https://docs.dagster.io/guides/automate/declarative-automation/customizing-automation-conditions/customizing-on-missing-condition
  - *"`AutomationCondition.any_deps_missing()`"* can be removed from an eager policy if missing upstream data is expected — https://docs.dagster.io/guides/automate/declarative-automation/customizing-automation-conditions/customizing-eager-condition

### Prefect (the runner used by this repo)

- **A `pending`/not-ready upstream leaves downstream `NotReady` (blocked) rather than aborting the flow; failures are retryable and configurable.**
  - *"Tasks automatically resolve dependencies based on data flow between them. When a task receives the result or future of an upstream task as input … a downstream task cannot begin until the upstream task has `Completed`."* — https://docs.prefect.io/v3/concepts/tasks
  - *"`retry_condition_fn`: An optional callable run when a task run returns a Failed state. Should return `True` if the task should continue to its retry policy … and `False` if the task should end as failed."* — https://docs.prefect.io/v3/api-ref/python/prefect-tasks
  - States `AwaitingRetry`/`Retrying` and terminal `Failed` are first-class: *"The run did not complete because of a code issue and had no remaining retry attempts."* — https://docs.prefect.io/v3/concepts/states
- **Concurrency is bounded by slots, so backfill breadth need not be capped by a hard `return`.**
  - *"Global concurrency limits … work by allocating a fixed number of 'slots' that must be acquired before an operation can proceed."* — https://docs.prefect.io/v3/concepts/global-concurrency-limits

### dbt (batch SQL, microbatch)

- **dbt rebuilds only the batches it decides are "new", driven by a watermark/bookmark, not by a global cursor that can be frozen.**
  - *"`lookback`: Process X batches prior to the latest bookmark to capture late-arriving records."* — https://docs.getdbt.com/docs/build/incremental-microbatch
  - *"No `is_incremental() block` needed — dbt automatically generates the appropriate `WHERE event_ts BETWEEN..` predicates per batch based on `event_time`, `batch_size`, `begin`, `lookback`."* — https://docs.getdbt.com/best-practices/how-we-handle-real-time-data/2-incremental-patterns

### Google Cloud Composer / Dataflow, AWS Glue / Step Functions

- **Composer/Airflow exposes the same catchup/backfill and warns about backfill deadlocks; the workaround is narrower ranges or disabling the mini-scheduler — i.e. never a permanent freeze.**
  - *"Catchup executes DAG runs that didn't run yet … You can use backfill to execute DAG runs for a certain range of dates."* — https://cloud.google.com/composer/docs/composer-3/schedule-and-trigger-dags
  - *"Backfill operation might sometimes generate a deadlock situation where a backfill is not possible because there is a lock on a task. … Run backfills for narrower date ranges."* — https://cloud.google.com/composer/docs/composer-3/troubleshooting-scheduling
- **AWS Glue tracks processed partitions via bookmarks (see Q2); a gap is a bookmark value, not a global stop.**

**Takeaway for Q1:** All major orchestrators default to independent partitions and provide an explicit mechanism (trigger rules, partition status, retries, `max_active_runs`, dynamic mapping) to avoid one bad partition freezing the rest. A global oldest-first `return` is the anti-pattern.

---

## Research Question 2 — Watermark / high-water-mark control tables and how they avoid a gap freezing progress

- **Definition / completeness predicate = "everything at or below the watermark has been processed."**
  - *"A watermark for time t is an assertion that the stream is (probably) now complete up through time t."* — https://nightlies.apache.org/flink/flink-docs-stable/docs/learn-flink/streaming_analytics/
  - *"A `Watermark(t)` declares that event time has reached time t in that stream, meaning that there should be no more elements from the stream with a timestamp t' <= t."* — https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/
- **Standard incremental predicate: `WHERE event_time > (select max(event_time) from target)`; `>=` plus lookback to absorb boundary/late rows.**
  - *"`event_time >= (select coalesce(max(event_time),'1900-01-01') from {{ this }} )`"* — https://docs.getdbt.com/docs/build/incremental-models
  - *"`where date_day >= (select coalesce(max(date_day), '1900-01-01') from {{ this }})`"* — https://docs.getdbt.com/docs/build/incremental-models
- **Control-table form: one row per source/partition with its own watermark, so one stuck source does not freeze the others.**
  - *"Use a watermark to track the last-processed row for each table and copy only new rows on each run. … The watermark control table is the source of truth for which tables to process and how far each table has been copied. Each row represents one source table."* — https://docs.databricks.com/aws/en/jobs/how-to/foreach-watermark-tutorial
  - *"The notebook runs once per table iteration. It reads the watermark, filters the source, writes to the target, and advances the watermark."* — same URL
  - *"Each pipeline maintains its own watermark per source table. Pipelines independent; one pipeline's failure doesn't affect other."* (third-party but consistent) — https://muhammadamal.my.id/blog/etl-idempotent-watermarks/
- **AWS Glue job bookmarks are the managed version: per-source state, rewound/paused without a global freeze.**
  - *"Job bookmarks help AWS Glue maintain state information and prevent the reprocessing of old data. … AWS Glue tracks which partitions the job has processed successfully to prevent duplicate processing."* — https://docs.aws.amazon.com/glue/latest/dg/monitor-continuations.html
  - *"You can rewind your job bookmarks for your AWS Glue Spark ETL jobs to any previous job run. You can support data backfilling scenarios better by rewinding your job bookmarks…"* — same URL
  - *"`job-bookmark-from` … The corresponding input is ignored. … `job-bookmark-to` … Any input later than this input is also excluded."* — same URL
- **How a gap is prevented from freezing the watermark: the watermark is derived from the *data actually seen* (`max(event_time)`), not from a scan that stops at the first missing partition. Orphans below the watermark are re-checked via lookback, and the watermark is per-partition/per-source.**
  - *"Always store `MAX(updated_at)` from the source batch as your watermark, not `NOW()`."* — https://www.wickedsmartdata.com/articles/incremental-query-design-with-watermark-tables-and-change-data-capture-tracking-and-processing-only-new-or-modified-records-in-sql-pipelines
  - *"Reading strictly above the last max skips rows that committed out of order below it. Subtract a safety margin sized to the measured maximum commit lateness so those rows are re-read."* — https://www.cross-engine-reconciliation.org/data-extraction-hashing-workflows/incremental-extraction-strategies/watermark-based-incremental-extraction/

**Takeaway for Q2:** The standard completeness predicate is a per-source predicate over the data (max timestamp / bookmark / offset), plus a `>=`/lookback margin. Our `gold=success AND serving=success` is a *set-of-rows* predicate (a "grid completeness" check), which is valid but must be evaluated **per date** and must include an explicit terminal state for known gaps (see Q3/Q4); otherwise a single missing row makes the whole grid incomplete forever.

---

## Research Question 3 — Known-gap / skipped / quarantined vs "lie success" vs "pending forever"

Patterns and their names in primary sources:

- **Skipped as a legitimate terminal state (Airflow).**
  - *"`skipped`: The task was skipped due to branching, LatestOnly, or similar."* — https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/tasks.html
  - *"`AirflowSkipException` will mark the current task as skipped."* — same URL
  - *"By setting `trigger_rule` to `none_failed` in `join` task … The `join` task will be triggered as soon as `branch_false` has been skipped (a valid completion state) and `follow_branch_a` has succeeded."* — https://airflow.apache.org/docs/apache-airflow/1.10.9/concepts.html
- **Missing/unmaterialized as an explicit partition status (Dagster).**
  - *"Statuses are persistent states … For example, the `AutomationCondition.missing()` condition will be true only if an asset partition has never been materialized."* — https://docs.dagster.io/guides/automate/declarative-automation/automation-condition-reference
  - *"Use the Dagster UI to track which partitions are materialized, failed, or missing. This helps identify gaps in your data."* — https://dagster-io-dagster-6.mintlify.app/concepts/partitions-backfills
- **Quarantine / dead-letter queue (DLQ) — the industry term for "known bad, don't block, keep provenance".**
  - *"`errors.deadletterqueue.topic.name`: The name of the topic to be used as the dead letter queue (DLQ) for messages that result in an error when processed by this sink connector … The topic name is blank by default, which means that no messages are to be recorded in the DLQ."* — https://kafka.apache.org/24/configuration/kafka-connect-configs/
  - KIP-298 headers preserve provenance: `__connect.errors.topic`, `.partition`, `.offset`, `.exception.message`, `.exception.stacktrace` — https://cwiki.apache.org/confluence/display/KAFKA/KIP-298%3A+Error+Handling+in+Connect
  - **Parking lot after N attempts** (a bounded retry then terminal quarantine): *"it moves them to a 'parking lot' topic after three attempts."* — https://docs.spring.io/spring-cloud-stream-binder-kafka/docs/current/reference/html/dlq.html
  - **Skip vs fail is a policy choice:** *"for sinks/streams, `type: skip` … the invalid record is dropped and the job keeps running"* while ledgers should `type: fail` (Apache StateFun / Flink DLQ design — secondary): https://dev.to/okazimirov/one-bad-kafka-record-shouldnt-crash-a-flink-stateful-functions-job-117
- **Tombstone (delete marker) is a related but distinct concept — a record whose value is null signalling "this key is gone"; do not confuse it with a gap marker.**
  - *"A tombstone is a Kafka message with a valid key and a `null` value. It is Kafka's native mechanism for signaling that a key has been removed."* — https://streamkap.com/resources-and-guides/cdc-soft-deletes-tombstones
- **Soft-delete flag (`is_deleted`/`deleted_at`) is the warehouse analogue of a tombstone.**
  - *"Instead of removing the row from the destination, the pipeline marks it as deleted by setting metadata columns."* — https://streamkap.com/resources-and-guides/cdc-soft-deletes-tombstones

**Takeaway for Q3:** The consensus is **four** terminal-ish outcomes, not two:
1. `success` (complete, trustworthy),
2. `failed` (retryable; explicit error),
3. `skipped`/`excluded`/`quarantined`/`abandoned` (known gap with reason + provenance; **counts as complete for downstream**),
4. `pending` (not yet arrived; **does not block unrelated partitions**, and has an expiry).

Marking a missing export `success` is the only option that is a lie and must be avoided. Leaving it `pending` forever is the current bug. The correct third state is a **gap/tombstone/quarantine record**.

---

## Research Question 4 — Late-arriving data, allowed lateness, expiry/SLA, and how a partition is abandoned

- **Bounded lateness windows are the standard mechanism; beyond the window data is dropped or routed aside.**
  - *"Allowed lateness specifies by how much time elements can be late before they are dropped, and its default value is 0. … Flink keeps the state of windows until their allowed lateness expires. Once this happens, Flink removes the window and deletes its state."* — https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/
  - *"By default the allowed lateness is 0. In other words, elements behind the watermark are dropped (or sent to the side output)."* — https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/
  - **Beam:** `withAllowedLateness` — *"Any elements that are later than this as decided by the system-maintained watermark will be dropped. This value also determines how long state will be kept around for old windows."* — https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/windowing/Window.html
  - **Spark:** *"A watermark delay (set with `withWatermark`) of '2 hours' guarantees that the engine will never drop any data that is less than 2 hours delayed. However, the guarantee is strict only in one direction. Data delayed by more than 2 hours is not guaranteed to be dropped."* — https://spark.apache.org/docs/latest/streaming/
- **Late data can be retained as a side output for later reconciliation instead of silently lost.**
  - *"Using Flink's side output feature you can get a stream of the data that was discarded as late. … `sideOutputLateData(OutputTag)`."* — https://nightlies.apache.org/flink/flink-docs-stable/docs/dev/datastream/operators/windows/
  - *"An `AfterWatermark` trigger … with late firings can update the window after the watermark; the default trigger fires once when the watermark passes the end of the window and then again when any late data arrives."* — https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/windowing/AfterWatermark.html
- **Idle/stalled inputs must not hold back the watermark of healthy inputs.**
  - *"If one of the input splits/partitions/shards does not carry events for a while … the watermark will be held back, because it is computed as the minimum over all the different parallel watermarks. … you can use a `WatermarkStrategy` that will detect idleness … `.withIdleness(Duration.ofMinutes(1))`"* — https://nightlies.apache.org/flink/flink-docs-master/docs/dev/datastream/event-time/generating_watermarks/
  - *"You can enable watermark alignment, which will make sure no sources/splits/shards/partitions increase their watermarks too far ahead of the rest."* — same URL
- **Retry windows and abandonment are explicit policy: bounded retries, a lookback, then a full-refresh/reset rather than an infinite stall.**
  - *"Add a lookback window to our cutoff point. By subtracting a few days from the `max(updated_at)`, we would capture any late data within the window of what we subtracted."* — https://docs.getdbt.com/best-practices/materializations/4-incremental-models
  - *"There is a way we can reset the relationship of the model to the source data. We can run the model with the `--full-refresh` flag."* — same URL
  - **SLA-driven expiry:** *"`error_after`: Duration (for example, 24 hours) after which dbt fails the freshness check if the most recent available data is older than this threshold."* — https://docs.getdbt.com/reference/resource-properties/freshness
  - **Prefect bounded retries + conditional give-up:** *"If a callable passed to `retry_condition_fn` returns `True`, the task will be retried. Otherwise, the task will exit with an exception."* — https://docs.prefect.io/v3/how-to-guides/workflows/retries
  - **DLQ "parking lot" after N attempts** (Spring): *"it moves them to a 'parking lot' topic after three attempts."* — https://docs.spring.io/spring-cloud-stream-binder-kafka/docs/current/reference/html/dlq.html

**Takeaway for Q4:** The decision to abandon is time-based (allowed lateness / SLA / max retries), and the record of abandonment is a quarantine/parking-lot/gap entry — not silent deletion. Late data arriving after abandonment is handled by idempotent re-apply (upsert/merge), or a deliberate `--full-refresh`.

---

## Research Question 5 — Idempotency and concurrency for a single-object read-modify-write control file

- **Use object-store compare-and-swap preconditions instead of unprotected overwrite.**
  - *"you can add an additional header to your `WRITE` requests to specify preconditions … `If-None-Match` … prevents overwrites … `If-Match` … check an object's entity tag (ETag) before writing an object. … If the ETag values don't match, the operation fails."* — https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
  - Failure semantics to handle: *"412 Precondition Failed"* and *"409 Conflict … On a 409 failure you should fetch the object's ETag and retry the upload."* — https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
  - **R2 (the store used here) supports the same headers on PutObject:** *"PutObject … Conditional Operations: ✅ If-Match … ✅ If-None-Match"* — https://developers.cloudflare.com/r2/api/s3/api/ ; *"PutObject supports conditional uploads via the `If-Match`, `If-None-Match` … rejected with `412 PreconditionFailed`"* — https://developers.cloudflare.com/r2/api/s3/extensions/
  - **GCS equivalent:** *"Precondition checks … allowing you to perform safe read-modify-write updates and conditional operations."* and *"`ifGenerationMatch` … If the values don't match, the request fails with a `412 Precondition Failed`."* — https://docs.cloud.google.com/storage/docs/request-preconditions
- **Transactional table formats solve this properly with optimistic concurrency + atomic metadata swap.**
  - *"Writers create table metadata files optimistically … it commits by swapping the table's metadata file pointer from the base version to the new version. If the snapshot on which an update is based is no longer current, the writer must retry the update based on the new current version."* — https://iceberg.apache.org/spec/
  - *"checks whether the proposed changes conflict with any other changes that may have been concurrently committed since the snapshot that was read. If there are no conflicts, all the staged changes are committed as a new versioned snapshot … if there are conflicts, the write operation fails with a concurrent modification exception."* — https://docs.delta.io/concurrency-control/
  - *"The storage system must allow Delta Lake to write the file, only if it does not exist already, and error out otherwise. … Delta implements a non locking MVCC … writers optimistically write new data and simply abandon the transaction if it conflicts at the end."* — https://delta-io.github.io/delta-rs/how-delta-lake-works/delta-lake-acid-transactions/
- **Idempotent destination writes make retries safe.**
  - *"As long as we have a `unique_key` defined in our config, we'll simply update existing rows and avoid duplication."* — https://docs.getdbt.com/best-practices/materializations/4-incremental-models
  - **Databricks selective/dynamic partition overwrite** replaces only the touched partitions: *"Dynamic partition overwrites replace all the existing data in each partition for which the write will commit new data and leaves all other partitions unchanged."* — https://docs.databricks.com/aws/en/delta/selective-overwrite
  - Delta `MERGE` / upsert is the recommended idempotent path for incremental loads: *"use a `MERGE` statement instead of `write.mode("append")` to upsert rows into the target table"* — https://docs.databricks.com/aws/en/jobs/how-to/foreach-watermark-tutorial
- **Single-writer discipline is the other half: bound concurrency to one writer.**
  - **Prefect tag/global concurrency limits** can enforce one writer: *"If a task has multiple tags, it will run only if all tags have available concurrency."* — https://docs.prefect.io/v3/concepts/tag-based-concurrency-limits
  - **AWS Glue explicitly warns that concurrent jobs corrupt bookmark semantics:** *"You have multiple concurrent jobs with job bookmarks, and the max concurrency isn't set to 1."* — https://repost.aws/knowledge-center/glue-reprocess-data-job-bookmarks-enabled
  - **Locking rows instead of files:** *"use `SELECT ... FOR UPDATE SKIP LOCKED` to implement advisory locking on the watermark row"* — https://www.wickedsmartdata.com/articles/incremental-query-design-with-watermark-tables-and-change-data-capture-tracking-and-processing-only-new-or-modified-records-in-sql-pipelines
- **Write-idempotency ordering:** *"make destination writes idempotent — always use upserts, never plain inserts, so that re-processing a batch is always safe. Update watermarks atomically with destination writes, or in the 'write first, then watermark' order."* — same URL

**Takeaway for Q5:** A whole-file `COPY ... OVERWRITE` on a shared Parquet control object with no precondition is the classic lost-update race. Mitigate with (a) an `If-Match`/ETag CAS loop + retry, (b) a single-writer lock (Prefect concurrency limit of 1), and/or (c) move control state into the transactional Postgres store already present (`PostgresServingRepository`) so read-modify-write is a transaction. Make every stage re-runnable (idempotent upsert / partition overwrite) so retries are safe.

---

## Recommended patterns for our case

The specific defect: in `apps/analytics/src/analytics/flows/nightly_etl.py:99-110`, a single `SourceState.PENDING` does `return current_date`, terminating the whole loop from `get_pending_dates` (control.py:30-41), whose predicate `gold=success AND serving=success` has no notion of a terminal gap. Below are concrete options, simplest first.

### Option A — Continue, don't return; make `pending` per-date (minimal change)
- Replace `return current_date` with `continue` (record the pending date, move to the next).
- Completeness predicate stays `gold=success AND serving=success`; only the missing date stays incomplete.
- **Tradeoff:** Fixes the immediate blocking bug with ~2 lines. Does **not** clean up the backlog of pending dates, and `get_pending_dates` will keep re-attempting 2026-08-05 forever. No lie, no gap record. Good first step, insufficient alone.
- Sources: Airflow independent runs (`catchup`/`max_active_runs`), Prefect state model, Dagster `on_missing`.

### Option B — Add an explicit terminal "gap" state + expiry ("abandon after N days")
- Extend stage status to include a first-class terminal state, e.g. `skipped`/`excluded`/`abandoned`, with columns for `reason`, `actor`, `decided_at`, `expires_at` (tombstone/gap record).
- Change the completeness predicate to: `gold=success AND serving IN ('success','skipped')` (skip counts as complete; `pending` does not).
- Add a rule: a date `pending` for more than N days auto-transitions to `abandoned` (or requires an operator tick), recording the gap. Keep the source export key so late data can re-open it.
- **Tradeoff:** Correct and industry-standard (Airflow `skipped`, Dagster `missing`, Kafka quarantine/parking-lot, DLQ). Requires schema change + a decision/actor trail; must not mark `success`. This is the recommended core fix.
- Sources: Airflow `AirflowSkipException`/`skipped`; Dagster partition status; Kafka Connect DLQ; Spring parking-lot; dbt `error_after` SLA.

### Option C — Decouple ordering: per-date tasks or dynamic mapping, capped by concurrency
- Model each incomplete date as an independent task (`expand` over `get_pending_dates` in Airflow, or `.map`/`.submit` in Prefect) so one child's `pending`/failure cannot abort its siblings; bound with `max_active_runs`/global concurrency limits.
- **Tradeoff:** Cleanest structural separation of "completeness of a date" from "ordering of the pipeline", and gives per-date retries/observability. Requires orchestrator support (Prefect `.map`, Airflow dynamic mapping) and idempotent tasks; more moving parts than B for a small date set.
- Sources: Airflow Dynamic Task Mapping; Dagster one-run-per-partition; Prefect concurrency limits.

### Option D — Make the control state transactional and race-free (do together with B/C)
- Either (i) keep the Parquet control object but guard writes with R2 `If-Match` ETag CAS + bounded retry (handle `412`/`409`), or (ii) move control state into the existing Postgres repository and do the read-modify-write in a transaction / `SELECT ... FOR UPDATE SKIP LOCKED`, or (iii) enforce a single writer with a Prefect concurrency limit of 1 tagged on the control-table update.
- Make each stage idempotent (partition overwrite / upsert) so retries and reopen-after-late-data are safe.
- **Tradeoff:** (i) keeps the object-store design but CAS on a whole file is coarse and retry-prone; (ii) is the most robust and reuses infrastructure already in the repo; (iii) is a cheap stopgap. Recommended: (ii) + (iii) if Postgres is already the serving store.
- Sources: S3/R2 conditional writes; Iceberg atomic swap; Delta optimistic concurrency; Glue max-concurrency=1 warning; Prefect concurrency limits.

**Suggested composition:** A immediately (stop the bleeding) → B + D (terminal gap record with expiry, transactional control state) as the durable design → C if/when the date backlog or concurrency warrants per-date parallelism. Never set a missing source to `success`; use the explicit gap/tombstone state.
