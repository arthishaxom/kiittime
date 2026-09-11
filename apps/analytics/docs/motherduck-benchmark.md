# MotherDuck/R2 benchmark (#129)

Run from `apps/analytics` after Gold Delta tables exist in R2:

```bash
export MOTHERDUCK_TOKEN='...'
export MOTHERDUCK_DATABASE='my_db'
export CF_ACCOUNT_ID='...'
export R2_ACCESS_KEY='...'
export R2_SECRET_KEY='...'
export R2_BUCKET_NAME='kiittime-analytics'
uv run python scripts/benchmark_motherduck.py --output benchmark.json --concurrency 4
```

The report also includes `dashboard_30d`, a single-connection request that loads
all dashboard panels with explicit columns. To verify a published/rebuilt Gold
date without writing anything:

```bash
uv run python scripts/verify_motherduck_r2.py --date 2026-08-26
```

To record MotherDuck usage/cost manually:

```bash
ENV_FILE=motherduck-cost.env ./scripts/record_motherduck_cost.sh
```

Use a read-only R2 key and a MotherDuck service token. The script reads credentials
only from environment variables, never prints them, and records 7/30/90/365-day
latency/row counts, EXPLAIN plans, and a concurrent 30-day run. Record cold and
warm runs by executing it twice. Record failures/timeouts and any rebuild/backfill
observations in the issue; do not commit `benchmark.json` if it contains sensitive
infrastructure details.
