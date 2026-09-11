# MotherDuck/R2 benchmark results (#129)

Run date: 2026-08-26. Reports were generated with the repository benchmark
script and contain no credentials.

## Results

| Range | Gold table query latency | Rows returned |
|---|---:|---:|
| 7 days | 1.43–2.13 s | 6–371 |
| 30 days | 1.59–2.18 s | 17–1,154 |
| 90 days | 1.42–2.14 s | 17–1,154 |
| 365 days | 1.52–2.32 s | 17–1,154 |

Four-user runs completed in 6.2–8.1 seconds wall time, with daily-usage
p50 latency between 2.04 and 2.61 seconds. A one-user run completed in about
5.8 seconds wall time, including setup and all benchmark queries.

## Evidence

MotherDuck successfully authenticated and read all three R2 Gold Delta tables
for 7, 30, 90, and 365-day ranges. The captured plans show `DELTA_SCAN`, remote
MotherDuck/R2 bridge execution, date filters, and explicit projected columns.

The 90/365-day row counts match the 30-day counts because the current Gold data
contains approximately 17 populated dates; this is a data-coverage observation,
not a query failure.

## Remaining acceptance evidence

- MotherDuck dashboard compute-cost estimate is not captured in the JSON reports.
- Invalid-credential/timeout behavior is not yet recorded.
- R2 Gold rebuild/backfill read verification is not yet recorded.
- The benchmark measures table reads, not the final consolidated dashboard API.

Generated JSON reports remain local artifacts and are intentionally not committed.
