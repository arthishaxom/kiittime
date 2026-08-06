# 6. Analytics & Admin Dashboard Data Engineering Pipeline

Date: 2026-08-04

## Status

Accepted

## Context

KIITTime has no observability or usage analytics today. The backend emits no structured logs, and there is no way to answer basic operational questions: how many students use the app daily, which endpoints are slow, which sections are searched most, or whether error rates are spiking. An admin dashboard exists (`apps/admin-webapp/`) but serves only timetable management — it has no analytics views.

Student-facing apps (mobile + webapp) have no login system. Students are identified only by roll number for the OTP-based timetable linking flow, and no JWT is issued to them. Only `AdminUser` rows (the admin webapp) authenticate via JWT. This means backend request logs cannot be used to derive DAU — a separate client-side instrumentation tool is required for anonymous user counting.

The existing free-tier infrastructure (Render, Aiven Postgres, Cloudflare R2, Vercel) has no budget for paid analytics platforms. The solution must run entirely within free tiers.

---

## Decision

### 1. Data Sources

| Source | Method | Destination |
|---|---|---|
| Backend API logs | `structlog` + async `QueueHandler` → `axiom-py` SDK | Axiom dataset `kiittime-backend-logs` (500 GB/mo, 30-day retention free) |
| User behaviour events | PostHog SDK on mobile + webapp | PostHog → native S3-compatible batch export → R2 Bronze |

**Why Axiom over Better Stack:** Better Stack free tier has 3-day log retention, which is incompatible with a nightly ETL pull. Axiom provides 30-day retention and a Query API at no cost.

**Logging architecture:**
```
FastAPI structlog → stdout (Render live tail / dev)
                 → QueueHandler → AxiomHandler (async background thread) → Axiom API
```

No Render log drain is used. Logging is wired directly in application code via `structlog` so it works identically in local dev (stdout only) and production (stdout + Axiom).

### 2. Axiom Log Schema

Every request emits the following structured fields:

| Field | Type | Source |
|---|---|---|
| `timestamp` | ISO-8601 | structlog auto |
| `level` | str | structlog auto |
| `event` | str | log message |
| `method` | str | request middleware |
| `path` | str | request middleware |
| `status_code` | int | response middleware |
| `duration_ms` | float | response middleware |
| `admin_user` | str or null | JWT claim — non-null only on `/admin/*` routes |
| `request_id` | str | `uuid4` per request, generated in middleware |
| `environment` | str | env var (`"production"` / `"dev"`) |
| `sections` | list of {name: str, year: int} or null | logged explicitly in the timetable handler only |

**Notes:**
- `admin_user` replaces the naive `user_id` field. Student requests are anonymous — no JWT is issued to students, so this field is always `null` for student traffic. It is used for admin action auditing only.
- `sections` is logged inside `GET /timetable/` handler (not middleware) because `section_id` is a query param (integer FK) and the handler already holds the resolved `Section` ORM objects with both `section_name` and `year`. Logging both avoids an ETL-time Postgres join and correctly disambiguates section names that repeat across academic years (the `UniqueConstraint` on `(section_name, year)` confirms names are not globally unique).
- IP address, request body, and full query strings are deliberately excluded (privacy + free-tier storage).

### 3. PostHog Event Taxonomy

Four events are instrumented on mobile + webapp. The sole analytical role of PostHog is **DAU derivation** via PostHog's anonymous `distinct_id` (device identity), since the backend has no mechanism to count distinct users.

| Event | Properties | Platform |
|---|---|---|
| `app_opened` | `platform` (ios / android / web) | mobile + webapp |
| `timetable_viewed` | `section_count`, `year` | mobile + webapp |
| `otp_requested` | (none) | mobile + webapp |
| `section_searched` | `query_length` | mobile + webapp |

Roll number, email, and section name are never sent to PostHog (PII).

PostHog's native S3-compatible batch export delivers events to `r2://kiittime-analytics/bronze/posthog/YYYY/MM/DD/` at no extra cost (1M rows/mo free).

### 4. Storage Layer: Cloudflare R2 (Medallion Architecture)

```
r2://kiittime-analytics/
  bronze/
    backend_logs/year=YYYY/month=MM/day=DD/   <- nightly pull from Axiom Query API (Hive-partitioned)
    posthog/YYYY/MM/DD/                        <- PostHog native batch export (plain date path via PostHog template vars)
  silver/
    api_requests/                              <- Delta Lake, partitioned by date
    section_requests/                          <- Delta Lake, partitioned by date
  gold/
    daily_usage/                               <- Delta Lake, partitioned by date
    endpoint_health/                           <- Delta Lake, partitioned by date
    section_trends/                            <- Delta Lake, partitioned by date
  _metadata/
    pipeline_runs.parquet                      <- control table for idempotent ETL (see section 4a)
```

R2 free tier: 10 GB storage, 1M Class A writes/mo, 10M Class B reads/mo. Sufficient at KIITTime's data volume (estimated <200k log rows/day).

### 5. Silver Schema

**Axiom Bronze schema** (`bronze/backend_logs/`) — one row per backend request as logged:

| Column | Type | Notes |
|---|---|---|
| `timestamp` | TIMESTAMP | When the API request happened (from structlog) |
| `ingested_at` | TIMESTAMP UTC | When our Prefect task pulled this row from Axiom — added by `pull_axiom_logs()` at write time. Distinct from `timestamp`: if we re-pull a date, `ingested_at` changes, `timestamp` does not. |
| `level`, `event`, `method`, `path`, `status_code`, `duration_ms`, `admin_user`, `request_id`, `environment`, `sections` | (see section 2) | Unchanged from Axiom log schema |

**PostHog Bronze schema** (`bronze/posthog/YYYY/MM/DD/`) — written directly by PostHog, not our code:

PostHog writes Parquet files. We do not add `ingested_at` because we are not in the write path. Row-level lineage uses PostHog's own `_inserted_at` field (when PostHog stored the event in their DB). Pipeline-level lineage is tracked by the control table `processed_at` (see section 4a).

Key PostHog fields used in transforms:

| Field | Type | Notes |
|---|---|---|
| `distinct_id` | VARCHAR | Anonymous device identity — used for DAU |
| `event` | VARCHAR | Event name (`app_opened`, `timetable_viewed`, etc.) |
| `timestamp` | TIMESTAMP | When the event happened on the device |
| `_inserted_at` | TIMESTAMP | When PostHog stored it internally — nearest equivalent to `ingested_at` for PostHog rows |
| `properties` | JSON | Event properties (platform, section_count, year, etc.) |

---

### 5. Silver Schema

**`silver_api_requests`** (one row per backend request):

| Column | Type | Derivation |
|---|---|---|
| `request_id` | VARCHAR | from log |
| `timestamp` | TIMESTAMP | from log |
| `ingested_at` | TIMESTAMP | from Bronze — when Axiom row was pulled |
| `date` | DATE | partition key, truncated from `timestamp` |
| `method` | VARCHAR | from log |
| `path` | VARCHAR | from log |
| `status_code` | INTEGER | from log |
| `duration_ms` | DOUBLE | from log |
| `admin_user` | VARCHAR | from log, null for student traffic |
| `environment` | VARCHAR | from log |
| `is_error` | BOOLEAN | derived: `status_code >= 400` |
| `is_timetable` | BOOLEAN | derived: `path = '/timetable/'` |
| `silver_ingested_at` | TIMESTAMP UTC | Added at Silver transform time — when our ETL wrote this Silver row. For PostHog-sourced Silver rows this is the only pipeline-side timestamp we own. |

**`silver_section_requests`** (exploded from `sections` array — one row per section per request):

| Column | Type | Derivation |
|---|---|---|
| `request_id` | VARCHAR | FK to `silver_api_requests` |
| `section_name` | VARCHAR | from `sections[].name` |
| `section_year` | INTEGER | from `sections[].year` |
| `date` | DATE | partition key, denormalized for query performance |

The array is exploded at Silver transform time using DuckDB `UNNEST`. Keeping `silver_section_requests` separate avoids wide rows and makes Gold aggregations simple GROUP BYs.

### 6. Gold Tables

**`gold_daily_usage`** — sourced from `silver_api_requests` + PostHog batch export:

| Column | Type |
|---|---|
| `date` | DATE |
| `dau` | INTEGER — COUNT(DISTINCT distinct_id) from PostHog |
| `total_api_calls` | INTEGER |
| `timetable_searches` | INTEGER |

**`gold_endpoint_health`** — sourced from `silver_api_requests`:

| Column | Type |
|---|---|
| `date` | DATE |
| `endpoint` | VARCHAR — normalized `path` |
| `total_calls` | INTEGER |
| `p95_latency_ms` | DOUBLE — PERCENTILE_CONT(0.95) on `duration_ms` |
| `error_rate` | DOUBLE — AVG(is_error::int) |

**`gold_section_trends`** — sourced from `silver_section_requests`:

| Column | Type |
|---|---|
| `date` | DATE |
| `section_name` | VARCHAR |
| `section_year` | INTEGER |
| `search_volume` | INTEGER |

### 4a. Pipeline Control Table (Idempotency)

The nightly ETL uses a **control table** stored at `r2://kiittime-analytics/_metadata/pipeline_runs.parquet` to make every run idempotent. At startup the flow scans for all incomplete dates and retries them before processing the new day — missed days due to crashes or bugs are automatically caught on the next run.

**Schema:**

| Column | Type | Description |
|---|---|---|
| `date` | DATE | Calendar date being processed (IST) |
| `source` | VARCHAR | `axiom`, `posthog`, or null for cross-source stages |
| `stage` | VARCHAR | `bronze`, `silver`, or `gold` |
| `status` | VARCHAR | `success` or `failed` |
| `processed_at` | TIMESTAMP UTC | When this row was written |
| `file_count` | INTEGER | Parquet files written (bronze stages only) |

**Flow logic:**

```python
pending = get_pending_dates(conn)   # all dates where gold != success, oldest first
for date in pending:
    if not success(date, 'axiom',   'bronze'): pull_axiom_logs(date)
    if not success(date, 'posthog', 'bronze'): check_posthog_files(date)
    if not success(date, None,      'silver'): run_silver(date)
    if not success(date, None,      'gold'):   run_gold(date)
```

Each task calls `mark_success` or `mark_failed` after completing. A `(date, stage)` already marked `success` is never re-processed.

**Watermark:** derived as `max(date WHERE stage='gold' AND status='success')` — used by the admin dashboard to show data freshness.

**PostHog timing:** The `check_posthog_files` task lists objects at `bronze/posthog/YYYY/MM/DD/` for the target date. If PostHog's export has not yet landed (files absent), the task marks the date pending and returns — the next run retries. No fixed sleep or deadline assumed.

**Why not Postgres:** keeping the control table in R2 Parquet via DuckDB maintains full decoupling of the analytics pipeline from the OLTP Postgres instance.

---

### 7. Transformation Engine: DuckDB + deltalake

All Bronze → Silver → Gold transforms use **DuckDB** (SQL-first, in-process columnar engine) with the `deltalake` Python library for Delta format writes.

**Why DuckDB over Pandas/Polars:**
- All transforms are SQL aggregations (GROUP BY, PERCENTILE_CONT, UNNEST, FILTER). DuckDB expresses these natively; no DataFrame API adds value.
- DuckDB reads R2 Parquet/Delta files directly via `httpfs` without loading to disk (`read_parquet('s3://...')`). No intermediate download step.
- Runs in-process inside the GCR container — no server to provision.
- The same DuckDB connection is reused by the FastAPI backend to serve Gold data to the admin dashboard, keeping one mental model across ETL and serving.
- At estimated data volumes (<200k rows/day), DuckDB processes a full day's Silver in milliseconds on a single vCPU.

**Pandas is not replaced in the existing OLTP timetable pipeline** (`apps/backend/pipeline/`) — that pipeline does row-oriented Excel parsing and ORM inserts, which Pandas handles correctly. DuckDB is introduced only in `apps/analytics/`.

**Polars is not added initially.** Should future transforms require complex algorithmic logic (rolling windows, custom scoring, ML feature engineering), Polars can be introduced alongside DuckDB without migration — DuckDB's `.pl()` method returns an Arrow-backed Polars DataFrame directly.

### 8. Orchestration

| Concern | Tool |
|---|---|
| Scheduling, retries, observability UI | Prefect Cloud Hobby (free: 5 deployments, 500 serverless min/mo) |
| Compute | Google Cloud Run via Prefect Push Work Pool (~50 hrs/mo free) |
| Pipeline code | `apps/analytics/` — new Python 3.12 package in the monorepo |

The nightly ETL flow runs at 02:00 IST. Steps:
1. Pull yesterday's logs from Axiom Query API → write to R2 Bronze (Parquet)
2. Transform Bronze → Silver (DuckDB, Delta write)
3. Transform Silver → Gold (DuckDB, Delta write)

PostHog Bronze files arrive via PostHog's own export scheduler — no Prefect task needed for ingestion.

### 9. apps/analytics/ Package Structure

```
apps/analytics/
├── pyproject.toml          # uv + uv_build, Python 3.12
├── Dockerfile              # python:3.12-slim
├── prefect.yaml            # Prefect deployment config
└── src/analytics/
    ├── __init__.py
    ├── flows/
    │   └── nightly_etl.py  # single Prefect flow
    ├── tasks/
    │   ├── axiom.py        # pull from Axiom Query API → R2 Bronze
    │   ├── posthog.py      # placeholder (PostHog exports natively)
    │   ├── transform.py    # DuckDB Bronze->Silver->Gold transforms
    │   └── load.py         # Delta Lake writes to R2
    └── config.py           # pydantic-settings + DuckDB conn factory
```

### 10. Secrets Management

Analytics pipeline secrets (Axiom API key, Cloudflare R2 access key + secret, Prefect Cloud API key) are stored in **Google Secret Manager**.

- GCR service accounts get IAM-gated access — no secrets in environment variables or code.
- Free tier: 6 secret versions x 10k access ops/mo — covers all 3 secrets with rotation headroom.
- Cloud Audit Logs provides secret access audit trail automatically.
- The Prefect Cloud API key is the bootstrap exception: it is set as a GCR environment variable to initialise the Prefect worker, which then accesses all other secrets via GSM.

### 11. DuckDB ↔ R2 Connectivity

R2 is S3-compatible. DuckDB reads it via the `httpfs` extension:

```python
conn.execute("""
    INSTALL httpfs; LOAD httpfs;
    CREATE SECRET r2 (
        TYPE S3,
        KEY_ID '${R2_ACCESS_KEY}',
        SECRET '${R2_SECRET_KEY}',
        ENDPOINT '${CF_ACCOUNT_ID}.r2.cloudflarestorage.com',
        REGION 'auto'
    );
""")
```

A `get_duckdb_conn()` factory in `config.py` configures this once and is injected into every task and the FastAPI analytics endpoints.

### 12. Admin Dashboard API

FastAPI serves Gold data to the admin webapp using in-process DuckDB queries against R2 Gold Delta files:

```
Admin webapp -> GET /admin/analytics/* -> FastAPI -> DuckDB -> R2 Gold -> JSON
```

Three endpoints, one per Gold table:

| Endpoint | Query param | Gold table |
|---|---|---|
| `GET /admin/analytics/usage` | `days=30` | `gold_daily_usage` |
| `GET /admin/analytics/endpoint-health` | `days=30` | `gold_endpoint_health` |
| `GET /admin/analytics/section-trends` | `days=7` | `gold_section_trends` |

The `days` parameter enables time-range filtering. The admin webapp exposes a preset range selector (`7D · 30D · 90D · 1Y · Custom`). TanStack Query fetches the three endpoints independently so charts load in parallel.

**Admin dashboard sections:**
- **Usage Overview** — DAU line chart, API calls vs timetable searches dual-line chart, today's KPI stat cards
- **Endpoint Health** — sortable endpoint health table, p95 latency trend line chart (top 5 endpoints)
- **Section Trends** — top 10 sections horizontal bar chart, searches by academic year donut chart

### 13. Industry Standard Caveat

The Axiom Query API nightly poll is a small-scale adaptation of the enterprise pattern (enterprise uses Kafka/Kinesis → real-time S3 streaming). At KIITTime's scale a nightly pull is correct and sufficient. The Observability Platform → Data Lake Medallion Architecture pattern (Bronze/Silver/Gold) is industry standard regardless of scale.

---

## Consequences

**Positive:**
- Full operational visibility: DAU, API health, section popularity — all queryable from the admin dashboard.
- Zero infrastructure cost within free tiers (itemised budget below).
- No schema changes to the existing Postgres database — analytics is fully decoupled from the OLTP layer.
- The medallion architecture scales: adding new Gold tables or new data sources requires only new Prefect tasks and DuckDB transforms, no platform changes.
- DuckDB + Delta on R2 means the analytics storage layer is queryable by any future tool (Polars, dbt-duckdb, MotherDuck, etc.) without migration.

**Negative / Trade-offs:**
- Nightly ETL means dashboard data is always 1 day behind. Real-time analytics would require Kafka + streaming, which is out of scope and out of budget.
- Render free tier spins down after 15 minutes of inactivity — the FastAPI analytics endpoints have cold-start latency on first admin dashboard load.
- Aiven Postgres can auto-sleep — the backend must handle reconnection gracefully (already managed by SQLAlchemy connection pooling).
- Google Secret Manager introduces a GCP dependency for the analytics pipeline. If the project moves off GCP compute, secrets must be migrated.
- Axiom 30-day retention means Bronze backend logs older than 30 days cannot be re-pulled. Once written to R2, Bronze is the permanent record — the nightly pull must not be skipped.

**Free Tier Budget:**

| Service | Free Limit | Role |
|---|---|---|
| Cloudflare R2 | 10 GB, 1M writes/mo | All analytics storage |
| Axiom | 500 GB/mo ingest, 30-day retention | Backend log observability + nightly ETL source |
| PostHog | 1M events/mo, 1M batch export rows/mo | User behaviour / DAU |
| Prefect Cloud Hobby | 5 deployments, 500 serverless min/mo | Pipeline orchestration |
| Google Cloud Run | ~50 hrs/mo 1 vCPU Always Free | ETL execution compute |
| Google Secret Manager | 6 secrets, 10k ops/mo free | Analytics pipeline secrets |
