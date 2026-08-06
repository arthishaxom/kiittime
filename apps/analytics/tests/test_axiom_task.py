"""Unit tests for Axiom Bronze pull task."""

from datetime import date
from unittest.mock import MagicMock, patch

from axiom_py import AplOptions
from axiom_py.query.result import Entry, QueryResult

from analytics.config import Settings
from analytics.tasks.axiom import pull_axiom_logs


def test_pull_axiom_logs_retries_configured():
    assert pull_axiom_logs.retries == 3
    assert pull_axiom_logs.retry_delay_seconds == 60


@patch("analytics.tasks.axiom.get_duckdb_conn")
@patch("axiom_py.Client")
def test_pull_axiom_logs_success(mock_axiom_client_cls, mock_get_duckdb_conn):
    mock_client = MagicMock()
    mock_axiom_client_cls.return_value = mock_client

    mock_entry = Entry(
        _time="2026-08-04T12:00:00Z",
        _sysTime="2026-08-04T12:00:00Z",
        _rowId="row-1",
        data={
            "timestamp": "2026-08-04T12:00:00Z",
            "level": "info",
            "event": "http_request",
            "method": "GET",
            "path": "/timetable/",
            "status_code": 200,
            "duration_ms": 15.5,
            "admin_user": None,
            "request_id": "req-1",
            "environment": "production",
            "sections": [{"name": "CSE-1", "year": 2026}],
        },
    )
    mock_result = QueryResult(
        request=None,
        status=MagicMock(),
        matches=[mock_entry],
        buckets=None,
        tables=None,
        dataset_names=["kiittime-backend-logs"],
        savedQueryID=None,
    )
    mock_client.apl_query.return_value = mock_result

    mock_conn = MagicMock()
    mock_get_duckdb_conn.return_value = mock_conn

    settings = Settings(
        AXIOM_API_KEY="test-key",
        AXIOM_DATASET="kiittime-backend-logs",
        R2_BUCKET_NAME="kiittime-analytics",
    )

    target_d = date(2026, 8, 4)
    res_date = pull_axiom_logs(target_date=target_d, settings=settings)
    assert res_date == target_d

    mock_axiom_client_cls.assert_called_once_with("test-key", org_id=None)
    mock_client.apl_query.assert_called_once()
    apl_str, opts_kwargs = (
        mock_client.apl_query.call_args[0][0],
        mock_client.apl_query.call_args[1],
    )
    assert "['kiittime-backend-logs']" in apl_str
    opts = opts_kwargs.get("opts")
    assert isinstance(opts, AplOptions)
    assert opts.start_time is not None
    assert opts.end_time is not None

    mock_conn.register.assert_called_once()
    mock_conn.execute.assert_called_once()
    sql_query = mock_conn.execute.call_args[0][0]
    assert "COPY" in sql_query
    assert "PARTITION_BY" in sql_query
    mock_conn.close.assert_called_once()


@patch("analytics.tasks.axiom.get_duckdb_conn")
@patch("axiom_py.Client")
def test_pull_axiom_logs_zero_rows(mock_axiom_client_cls, mock_get_duckdb_conn):
    mock_client = MagicMock()
    mock_axiom_client_cls.return_value = mock_client

    mock_result = QueryResult(
        request=None,
        status=MagicMock(),
        matches=[],
        buckets=None,
        tables=None,
        dataset_names=["kiittime-backend-logs"],
        savedQueryID=None,
    )
    mock_client.apl_query.return_value = mock_result

    mock_conn = MagicMock()
    mock_get_duckdb_conn.return_value = mock_conn

    settings = Settings(
        AXIOM_API_KEY="test-key",
        AXIOM_DATASET="kiittime-backend-logs",
        R2_BUCKET_NAME="kiittime-analytics",
    )

    target_d = date(2026, 8, 4)
    res_date = pull_axiom_logs(target_date=target_d, settings=settings)
    assert res_date == target_d

    mock_conn.register.assert_called_once()
    mock_conn.execute.assert_called_once()
    sql_query = mock_conn.execute.call_args[0][0]
    assert "COPY" in sql_query
    assert "WHERE 1=0" in sql_query
    assert "PARTITION_BY" in sql_query
    mock_conn.close.assert_called_once()


@patch("analytics.tasks.axiom.get_duckdb_conn")
@patch("axiom_py.Client")
def test_pull_axiom_logs_default_target_date(mock_axiom_client_cls, mock_get_duckdb_conn):
    mock_client = MagicMock()
    mock_axiom_client_cls.return_value = mock_client
    mock_result = QueryResult(
        request=None,
        status=MagicMock(),
        matches=[],
        buckets=None,
        tables=None,
        dataset_names=["kiittime-backend-logs"],
        savedQueryID=None,
    )
    mock_client.apl_query.return_value = mock_result

    mock_conn = MagicMock()
    mock_get_duckdb_conn.return_value = mock_conn

    settings = Settings(
        AXIOM_API_KEY="test-key",
        AXIOM_DATASET="kiittime-backend-logs",
        R2_BUCKET_NAME="kiittime-analytics",
    )

    res_date = pull_axiom_logs(target_date=None, settings=settings)
    assert isinstance(res_date, date)

