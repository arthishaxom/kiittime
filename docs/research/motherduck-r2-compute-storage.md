# MotherDuck + R2 Compute/Storage Research

Date: 2026-08-26

## Conclusion

R2 can remain the canonical storage layer while DuckDB/MotherDuck performs compute over the Delta/Parquet files in place. MotherDuck does not require all source data to be copied into MotherDuck-managed tables. A separate copy is optional: ingesting into a native MotherDuck table can improve repeated-query latency and concurrency, but creates another data copy and synchronization path.

MotherDuck itself also separates compute from its own managed storage: cloud DuckDB instances execute queries while durable data is stored in object storage and cached on SSD/memory. With external R2 data, the analogous architecture is R2 durable storage plus MotherDuck cloud DuckDB compute.

## Request flow for KIITTime

```text
Prefect ETL -> DuckDB/MotherDuck compute -> writes Gold Delta files -> R2
FastAPI -> MotherDuck session/query -> delta_scan(R2 Gold) -> JSON
```

FastAPI sends SQL/query parameters, not the full dataset. MotherDuck's cloud execution reads R2 through its S3-compatible endpoint. If a query is run locally instead, the Render worker reads R2 and remains the bottleneck; the query must be explicitly routed to remote MotherDuck compute and tested.

## In-place query vs copied tables

### In-place external Delta/Parquet (recommended first)

Use `delta_scan('s3://...')` with an R2 S3 endpoint/secret, or an equivalent external-table configuration. Data stays in R2; MotherDuck reads only data needed by the query. Benefits: one source of truth, easy rebuild/backfill, no warehouse-ingestion copy. Costs: object-store metadata/network latency, dependence on Delta layout, and potentially less predictable dashboard latency.

### Native MotherDuck tables (optional serving/cache copy)

`CREATE TABLE ... AS SELECT ... FROM delta_scan(...)` loads a copy into MotherDuck-managed storage. Repeated reads may be faster and more isolated from R2 latency, but ETL must publish/replace/refresh it and R2 remains the recovery source. For this small, nightly, pre-aggregated gold layer, only benchmark evidence should justify this duplication.

### DuckLake note

MotherDuck's DuckLake option still stores table data as Parquet in ordinary object storage, including a customer bucket; it moves/centralizes table metadata rather than requiring bulk data in MotherDuck. This is a future table-format option, not a reason to migrate the current Delta tables immediately.

## Predicate pushdown and partial reads

For a direct scan, the SQL plan should retain filters and projections at the scan boundary:

```sql
SELECT date, endpoint, total_calls, p95_latency_ms, error_rate
FROM delta_scan('s3://bucket/gold/endpoint_health')
WHERE date >= current_date - INTERVAL 30 DAY
  AND endpoint IN (...);
```

DuckDB's Delta extension supports partition/file skipping, Parquet row-group skipping via statistics/zonemaps, filter pushdown, and projection pushdown. Parquet partial reading means only required columns and relevant byte ranges/row groups are fetched; it does not mean zero R2 requests. Delta metadata must first identify candidate files, and poorly sized/sorted/partitioned files can still cause many remote requests.

Partition by fields commonly filtered (`date` here), select only required columns, avoid `SELECT *`, use sensible file/row-group sizes, and inspect `EXPLAIN ANALYZE`/filtered-file output. Preserve simple predicates on the partition column; wrapping the column in functions can weaken pruning.

The current `DeltaTable.to_pyarrow_table()` path materializes before DuckDB filtering, so it forfeits these benefits. Replace it with a lazy DuckDB `delta_scan` query, or use delta-rs dataset reads with explicit partition filters and column projection.

## Production standard applied here

The broadly used production pattern is: object storage/lakehouse as durable system of record; separate elastic analytical compute; and a serving projection/cache for latency-sensitive, high-concurrency APIs. Start with R2 + remote MotherDuck querying the already-aggregated Gold tables. Add a native MotherDuck copy or small PostgreSQL/OLAP serving projection only if latency/concurrency/cost benchmarks require it. Do not put the entire Bronze/Silver history in PostgreSQL merely to serve three dashboard charts.

## Sources

- DuckDB Delta extension: https://duckdb.org/docs/current/core_extensions/delta
- DuckDB Parquet partial/filter/projection reads: https://duckdb.org/docs/lts/data/parquet/overview
- DuckDB remote HTTP range reads: https://duckdb.org/docs/lts/core_extensions/httpfs/https
- MotherDuck architecture and separated compute/storage: https://motherduck.com/research/motherduck-duckdb-in-the-cloud-and-in-the-client/
- MotherDuck external S3 querying: https://motherduck.com/duckdb-book-summary-chapter7/
- MotherDuck DuckLake and customer-owned object storage: https://motherduck.com/product/ducklake/
- Cloudflare R2 S3-compatible API: https://developers.cloudflare.com/r2/api/
