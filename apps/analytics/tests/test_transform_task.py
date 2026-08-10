"""Unit tests for Bronze to Silver DuckDB transform task."""

from datetime import date

import duckdb
from deltalake import DeltaTable

from analytics.tasks.transform import transform_bronze_to_silver, transform_silver_to_gold


def test_transform_bronze_to_silver_retries_configured():
    assert transform_bronze_to_silver.retries == 3
    assert transform_bronze_to_silver.retry_delay_seconds == 60


def test_transform_bronze_to_silver_success(tmp_path):
    target_d = date(2026, 8, 4)

    conn = duckdb.connect()
    payload = [
        {
            "request_id": "req-1",
            "timestamp": "2026-08-04T10:00:00Z",
            "ingested_at": "2026-08-04T10:01:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 12.5,
            "admin_user": None,
            "environment": "production",
            "sections": [{"name": "22CSE1", "year": 2}],
        },
        {
            "request_id": "req-2",
            "timestamp": "2026-08-04T10:05:00Z",
            "ingested_at": "2026-08-04T10:06:00Z",
            "method": "POST",
            "path": "/admin/login",
            "status_code": 403,
            "duration_ms": 5.0,
            "admin_user": "admin1",
            "environment": "production",
            "sections": None,
        },
        {
            "request_id": "req-3",
            "timestamp": "2026-08-04T10:10:00Z",
            "ingested_at": "2026-08-04T10:11:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 500,
            "duration_ms": 100.0,
            "admin_user": None,
            "environment": "production",
            "sections": [],
        },
    ]

    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "logs.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{parquet_str}' (FORMAT PARQUET)",
        [payload],
    )
    conn.close()

    silver_base_dir = tmp_path / "silver"

    res_date = transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )
    assert res_date == target_d

    # Verify silver_api_requests
    api_dt = DeltaTable(str(silver_base_dir / "silver_api_requests"))
    api_table = api_dt.to_pyarrow_table()
    api_dict = api_table.to_pydict()

    assert len(api_dict["request_id"]) == 3
    assert api_dict["request_id"] == ["req-1", "req-2", "req-3"]
    assert api_dict["is_error"] == [False, True, True]
    assert api_dict["is_timetable"] == [True, False, True]
    assert api_dict["date"] == [target_d, target_d, target_d]
    assert "silver_ingested_at" in api_dict
    assert all(ts is not None for ts in api_dict["silver_ingested_at"])

    # Verify silver_section_requests
    sec_dt = DeltaTable(str(silver_base_dir / "silver_section_requests"))
    sec_table = sec_dt.to_pyarrow_table()
    sec_dict = sec_table.to_pydict()

    assert len(sec_dict["request_id"]) == 1
    assert sec_dict["request_id"] == ["req-1"]
    assert sec_dict["section_name"] == ["22CSE1"]
    assert sec_dict["section_year"] == [2]
    assert sec_dict["date"] == [target_d]
    assert "silver_ingested_at" in sec_dict


def test_transform_bronze_to_silver_idempotence(tmp_path):
    target_d = date(2026, 8, 4)

    conn = duckdb.connect()
    payload = [
        {
            "request_id": "req-1",
            "timestamp": "2026-08-04T10:00:00Z",
            "ingested_at": "2026-08-04T10:01:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 12.5,
            "admin_user": None,
            "environment": "production",
            "sections": [{"name": "22CSE1", "year": 2}],
        }
    ]

    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "logs.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{parquet_str}' (FORMAT PARQUET)",
        [payload],
    )
    conn.close()

    silver_base_dir = tmp_path / "silver"

    # First run
    transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )

    # Second run for same date
    transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )

    api_dt = DeltaTable(str(silver_base_dir / "silver_api_requests"))
    assert api_dt.to_pyarrow_table().num_rows == 1

    sec_dt = DeltaTable(str(silver_base_dir / "silver_section_requests"))
    assert sec_dt.to_pyarrow_table().num_rows == 1


def test_transform_bronze_to_silver_default_target_date(tmp_path):
    silver_base_dir = tmp_path / "silver"
    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "empty.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn = duckdb.connect()
    copy_sql = (
        f"COPY (SELECT 'req-1' AS request_id, '2026-08-04T10:00:00Z' AS timestamp, "
        f"'2026-08-04T10:00:00Z' AS ingested_at, 'GET' AS method, '/timetable/' AS path, "
        f"200 AS status_code, 1.0 AS duration_ms, CAST(NULL AS VARCHAR) AS admin_user, "
        f"'dev' AS environment, CAST(NULL AS STRUCT(name VARCHAR, year INT)[]) AS sections "
        f"WHERE 1=0) TO '{parquet_str}' (FORMAT PARQUET)"
    )
    conn.execute(copy_sql)
    conn.close()

    res_date = transform_bronze_to_silver.fn(
        target_date=None,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )
    assert isinstance(res_date, date)


def test_transform_bronze_to_silver_missing_optional_columns(tmp_path):
    target_d = date(2026, 8, 4)
    silver_base_dir = tmp_path / "silver"
    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "no_admin.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn = duckdb.connect()
    payload = [
        {
            "request_id": "req-1",
            "timestamp": "2026-08-04T10:00:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 12.5,
            "environment": "production",
        }
    ]
    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{parquet_str}' (FORMAT PARQUET)",
        [payload],
    )
    conn.close()

    res_date = transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )
    assert res_date == target_d

    api_dt = DeltaTable(str(silver_base_dir / "silver_api_requests"))
    api_dict = api_dt.to_pyarrow_table().to_pydict()
    assert api_dict["request_id"] == ["req-1"]
    assert api_dict["admin_user"] == [None]
    assert api_dict["ingested_at"] == [None]


def test_transform_silver_to_gold_retries_configured():
    assert transform_silver_to_gold.retries == 3
    assert transform_silver_to_gold.retry_delay_seconds == 60


def test_transform_silver_to_gold_success(tmp_path):
    target_d = date(2026, 8, 4)

    conn = duckdb.connect()
    payload = [
        {
            "request_id": "req-1",
            "timestamp": "2026-08-04T10:00:00Z",
            "ingested_at": "2026-08-04T10:01:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 10.0,
            "admin_user": None,
            "environment": "production",
            "sections": [{"name": "22CSE1", "year": 2}],
        },
        {
            "request_id": "req-2",
            "timestamp": "2026-08-04T10:05:00Z",
            "ingested_at": "2026-08-04T10:06:00Z",
            "method": "POST",
            "path": "/admin/users/123",
            "status_code": 403,
            "duration_ms": 20.0,
            "admin_user": "admin1",
            "environment": "production",
            "sections": None,
        },
        {
            "request_id": "req-3",
            "timestamp": "2026-08-04T10:10:00Z",
            "ingested_at": "2026-08-04T10:11:00Z",
            "method": "GET",
            "path": "/admin/users/456/",
            "status_code": 200,
            "duration_ms": 100.0,
            "admin_user": None,
            "environment": "production",
            "sections": [{"name": "22CSE1", "year": 2}],
        },
    ]

    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "logs.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{parquet_str}' (FORMAT PARQUET)",
        [payload],
    )

    posthog_dir = tmp_path / "bronze" / "posthog" / "2026" / "08" / "04"
    posthog_dir.mkdir(parents=True, exist_ok=True)
    posthog_file = posthog_dir / "events.parquet"
    posthog_str = str(posthog_file).replace("\\", "/")

    posthog_payload = [
        {"distinct_id": "user-a", "event": "app_opened"},
        {"distinct_id": "user-b", "event": "timetable_viewed"},
        {"distinct_id": "user-a", "event": "timetable_viewed"},
    ]
    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{posthog_str}' (FORMAT PARQUET)",
        [posthog_payload],
    )
    conn.close()

    silver_base_dir = tmp_path / "silver"
    gold_base_dir = tmp_path / "gold"

    transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )

    res_date = transform_silver_to_gold.fn(
        target_date=target_d,
        silver_base_path=str(silver_base_dir),
        posthog_bronze_path=posthog_str,
        gold_base_path=str(gold_base_dir),
    )
    assert res_date == target_d

    # Verify gold_daily_usage
    daily_dt = DeltaTable(str(gold_base_dir / "gold_daily_usage"))
    daily_dict = daily_dt.to_pyarrow_table().to_pydict()
    assert daily_dict["date"] == [target_d]
    assert daily_dict["dau"] == [2]
    assert daily_dict["total_api_calls"] == [3]
    assert daily_dict["timetable_searches"] == [1]

    # Verify gold_endpoint_health
    health_dt = DeltaTable(str(gold_base_dir / "gold_endpoint_health"))
    health_dict = health_dt.to_pyarrow_table().to_pydict()
    endpoints = dict(
        zip(
            health_dict["endpoint"],
            zip(
                health_dict["total_calls"],
                health_dict["error_rate"],
                health_dict["p95_latency_ms"],
            ),
        )
    )

    assert "/timetable" in endpoints
    assert endpoints["/timetable"][0] == 1
    assert endpoints["/timetable"][1] == 0.0
    assert endpoints["/timetable"][2] == 10.0

    assert "/admin/users/:id" in endpoints
    assert endpoints["/admin/users/:id"][0] == 2
    assert endpoints["/admin/users/:id"][1] == 0.5
    assert endpoints["/admin/users/:id"][2] == 96.0

    # Verify gold_section_trends
    trends_dt = DeltaTable(str(gold_base_dir / "gold_section_trends"))
    trends_dict = trends_dt.to_pyarrow_table().to_pydict()
    assert trends_dict["date"] == [target_d]
    assert trends_dict["section_name"] == ["22CSE1"]
    assert trends_dict["section_year"] == [2]
    assert trends_dict["search_volume"] == [2]


def test_transform_silver_to_gold_idempotence(tmp_path):
    target_d = date(2026, 8, 4)

    conn = duckdb.connect()
    payload = [
        {
            "request_id": "req-1",
            "timestamp": "2026-08-04T10:00:00Z",
            "ingested_at": "2026-08-04T10:01:00Z",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 12.5,
            "admin_user": None,
            "environment": "production",
            "sections": [{"name": "22CSE1", "year": 2}],
        }
    ]

    bronze_dir = tmp_path / "bronze"
    bronze_dir.mkdir(parents=True, exist_ok=True)
    parquet_file = bronze_dir / "logs.parquet"
    parquet_str = str(parquet_file).replace("\\", "/")

    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{parquet_str}' (FORMAT PARQUET)",
        [payload],
    )
    conn.close()

    silver_base_dir = tmp_path / "silver"
    gold_base_dir = tmp_path / "gold"

    transform_bronze_to_silver.fn(
        target_date=target_d,
        bronze_path=parquet_str,
        silver_base_path=str(silver_base_dir),
    )

    # First run
    transform_silver_to_gold.fn(
        target_date=target_d,
        silver_base_path=str(silver_base_dir),
        posthog_bronze_path=str(tmp_path / "non_existent.parquet"),
        gold_base_path=str(gold_base_dir),
    )

    # Second run
    transform_silver_to_gold.fn(
        target_date=target_d,
        silver_base_path=str(silver_base_dir),
        posthog_bronze_path=str(tmp_path / "non_existent.parquet"),
        gold_base_path=str(gold_base_dir),
    )

    daily_dt = DeltaTable(str(gold_base_dir / "gold_daily_usage"))
    assert daily_dt.to_pyarrow_table().num_rows == 1

    health_dt = DeltaTable(str(gold_base_dir / "gold_endpoint_health"))
    assert health_dt.to_pyarrow_table().num_rows == 1

    trends_dt = DeltaTable(str(gold_base_dir / "gold_section_trends"))
    assert trends_dt.to_pyarrow_table().num_rows == 1


def test_transform_silver_to_gold_missing_posthog(tmp_path):
    target_d = date(2026, 8, 4)

    silver_base_dir = tmp_path / "silver"
    gold_base_dir = tmp_path / "gold"

    res_date = transform_silver_to_gold.fn(
        target_date=target_d,
        silver_base_path=str(silver_base_dir),
        posthog_bronze_path=str(tmp_path / "missing_posthog.parquet"),
        gold_base_path=str(gold_base_dir),
    )
    assert res_date == target_d

    daily_dt = DeltaTable(str(gold_base_dir / "gold_daily_usage"))
    daily_dict = daily_dt.to_pyarrow_table().to_pydict()
    assert daily_dict["date"] == [target_d]
    assert daily_dict["dau"] == [0]
    assert daily_dict["total_api_calls"] == [0]
    assert daily_dict["timetable_searches"] == [0]


def test_transform_silver_to_gold_posthog_zst(tmp_path):
    target_d = date(2026, 8, 9)

    posthog_dir = tmp_path / "bronze" / "posthog" / "2026" / "08" / "09"
    posthog_dir.mkdir(parents=True, exist_ok=True)
    posthog_file = posthog_dir / "events.parquet.zst"
    posthog_str = str(posthog_file).replace("\\", "/")

    conn = duckdb.connect()
    posthog_payload = [
        {"distinct_id": "user-1", "event": "app_opened"},
        {"distinct_id": "user-2", "event": "app_opened"},
        {"distinct_id": "user-1", "event": "timetable_viewed"},
    ]
    conn.execute(
        f"COPY (SELECT t.* FROM (SELECT unnest(?) AS t)) TO '{posthog_str}' (FORMAT PARQUET, CODEC 'ZSTD')",
        [posthog_payload],
    )
    conn.close()

    silver_base_dir = tmp_path / "silver"
    gold_base_dir = tmp_path / "gold"

    # Test with glob pattern default
    posthog_glob = f"{tmp_path}/bronze/posthog/2026/08/09/*.parquet*"

    res_date = transform_silver_to_gold.fn(
        target_date=target_d,
        silver_base_path=str(silver_base_dir),
        posthog_bronze_path=posthog_glob,
        gold_base_path=str(gold_base_dir),
    )
    assert res_date == target_d

    daily_dt = DeltaTable(str(gold_base_dir / "gold_daily_usage"))
    daily_dict = daily_dt.to_pyarrow_table().to_pydict()
    assert daily_dict["dau"] == [2]



