# Analytics nightly ETL — deploy and verify runbook

Rollout procedure for the artifact-derived completion + Gap Ledger + derived freshness
change (analytics issues #146/#149). The repo-side code is merged; the steps below are
the production steps an operator runs.

## Required access

- Merged `main` (Render backend auto-deploys and runs `alembic upgrade head` on boot).
- Prefect Cloud: `PREFECT_API_KEY`, `PREFECT_API_URL`, and secret-block read access for
  the `nightly-etl` deployment.
- R2 credentials in `apps/analytics/.env` and the production writer URL
  (`ANALYTICS_WRITER_DATABASE_URL`).
- An admin session/JWT for the dashboard check.

## Order

Migrations (Render boot) → Prefect deployment re-registration → control-row migration →
manual flow run → verification. The flow reads `analytics.pipeline_gaps`, so the table
and the migrated `2026-08-05` row must exist before the first run.

## 1. Merge and let migrations apply

Merge the PR to `main`. Render's start command (`render.yaml`) runs
`uv run alembic upgrade head` on boot, applying:

- `c3f0a1b2d4e5` — creates `analytics.pipeline_gaps`.
- `e5b7c9d1f3a2` — adds `published_at` to the serving tables, drops `sync_metadata`.

Confirm before continuing:

```sql
SELECT version_num FROM alembic_version;
```

## 2. Re-register the Prefect deployment

```bash
cd apps/analytics
uv run prefect deploy --all --no-prompt
```

The deployment pulls `main`, so it must run after the merge.

## 3. Migrate the retired R2 control rows into the Gap Ledger

The R2 control object `_metadata/pipeline_runs.parquet` is retired to read-only audit;
its serving `skipped` rows (including `2026-08-05`) move into `analytics.pipeline_gaps`.

```bash
cd apps/analytics
ANALYTICS_WRITER_DATABASE_URL=<prod-writer-url> uv run python scripts/migrate_r2_control.py
ANALYTICS_WRITER_DATABASE_URL=<prod-writer-url> uv run python scripts/migrate_r2_control.py --verify-only
```

`--verify-only` must print `Verification OK`. The script never writes the R2 object.

## 4. Manual flow run

```bash
cd apps/analytics
uv run prefect deployment run 'nightly-etl-flow/nightly-etl'
```

Watch the run logs for `sync_gold_to_postgres` executing and for the gapped date being
skipped rather than retried.

## 5. Verify

Gap recorded once, with a reason:

```sql
SELECT date, source, reason, decided_at
FROM analytics.pipeline_gaps
WHERE date = '2026-08-05';
```

Expect exactly one row. The next run's pending set excludes gapped dates; only the
late-arrival re-check touches it.

`data_as_of` advances across the gap; `stale` reflects only the clock:

```sql
SELECT max(date) AS newest_gold FROM analytics.gold_daily_usage;
SELECT max(date) AS newest_gap FROM analytics.pipeline_gaps;
```

`data_as_of` is the newer of the two. It is `stale` only when the most recent
`ANALYTICS_PUBLISH_HOUR_IST` (default 02:00, `Asia/Kolkata`, matching `prefect.yaml`'s
cron) boundary is later than `data_as_of`.

R2↔PG parity, via `read_gold_snapshot()` rather than a `**/*.parquet` glob:

```bash
cd apps/analytics
ANALYTICS_WRITER_DATABASE_URL=<prod-writer-url> uv run python - <<'PY'
import sqlalchemy as sa

from analytics.config import get_settings
from analytics.serving import (
    PostgresServingRepository,
    gold_daily_usage,
    gold_endpoint_health,
    gold_section_trends,
    read_gold_snapshot,
)

settings = get_settings()
snapshot = read_gold_snapshot(settings)
repository = PostgresServingRepository(settings)
for name, rows, table in (
    ("gold_daily_usage", snapshot.daily_usage, gold_daily_usage),
    ("gold_endpoint_health", snapshot.endpoint_health, gold_endpoint_health),
    ("gold_section_trends", snapshot.section_trends, gold_section_trends),
):
    r2_dates = {row["date"] for row in rows}
    with repository.engine.begin() as conn:
        pg_dates = set(conn.execute(sa.select(table.c.date)).scalars())
    print(
        f"{name}: r2={len(r2_dates)} pg={len(pg_dates)} "
        f"only_r2={sorted(r2_dates - pg_dates)} only_pg={sorted(pg_dates - r2_dates)}"
    )
PY
```

A date present in R2 but not PG is a gap to chase (unpublished or failed publication);
anything `only_pg` predates the serving snapshot's rebuild and should not exist.

Dashboard is not 503 and panels populate:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer <admin-jwt>" \
  "<backend-url>/admin/analytics/dashboard?days=30"
```

Then confirm the admin dashboard renders usage, endpoint health, section trends, and
the `data_as_of`/`synced_at`/stale indicators.

Finally, confirm `_metadata/pipeline_runs.parquet` is unchanged and still read-only as
audit (the migration script has no write path to it).
