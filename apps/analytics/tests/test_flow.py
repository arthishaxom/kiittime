"""Tests for nightly_etl Prefect flow."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from analytics.flows.nightly_etl import nightly_etl_flow


def test_nightly_etl_flow_explicit_date():
    target = date(2026, 8, 5)
    with (
        patch("analytics.flows.nightly_etl.get_settings") as mock_get_settings,
        patch("analytics.flows.nightly_etl.get_duckdb_conn") as mock_get_conn,
        patch("analytics.flows.nightly_etl.get_pending_dates", return_value=[target]),
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs") as mock_pull,
        patch("analytics.flows.nightly_etl.check_posthog_files") as mock_posthog,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as mock_silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as mock_gold,
    ):
        mock_get_settings.return_value = SimpleNamespace(R2_BUCKET_NAME="test-bucket")
        mock_get_conn.return_value = MagicMock()
        mock_pull.return_value = target
        mock_posthog.return_value = True
        mock_silver.return_value = target
        mock_gold.return_value = target

        result = nightly_etl_flow.fn(target_date=target)

        assert result == target
        mock_pull.assert_called_once_with(target_date=target)
        mock_silver.assert_called_once_with(target_date=target)
        mock_gold.assert_called_once_with(target_date=target)


def test_nightly_etl_flow_default_date():
    with (
        patch("analytics.flows.nightly_etl.get_settings") as mock_get_settings,
        patch("analytics.flows.nightly_etl.get_duckdb_conn") as mock_get_conn,
        patch("analytics.flows.nightly_etl.get_pending_dates") as mock_pending,
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs") as mock_pull,
        patch("analytics.flows.nightly_etl.check_posthog_files") as mock_posthog,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as mock_silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as mock_gold,
    ):
        mock_get_settings.return_value = SimpleNamespace(R2_BUCKET_NAME="test-bucket")
        mock_get_conn.return_value = MagicMock()
        mock_pull.side_effect = lambda target_date: target_date
        mock_posthog.return_value = True

        mock_pending.side_effect = lambda _conn, _path, target_date: [target_date]

        result = nightly_etl_flow.fn()

        assert isinstance(result, date)
        mock_pull.assert_called_once()
        mock_silver.assert_called_once_with(target_date=result)
        mock_gold.assert_called_once_with(target_date=result)


def test_nightly_etl_flow_runs_posthog_and_gold_when_axiom_is_empty():
    target = date(2026, 8, 5)
    with (
        patch("analytics.flows.nightly_etl.get_settings") as mock_get_settings,
        patch("analytics.flows.nightly_etl.get_duckdb_conn") as mock_get_conn,
        patch("analytics.flows.nightly_etl.get_pending_dates", return_value=[target]),
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs") as mock_pull,
        patch("analytics.flows.nightly_etl.check_posthog_files") as mock_posthog,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as mock_silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as mock_gold,
    ):
        mock_get_settings.return_value = SimpleNamespace(R2_BUCKET_NAME="test-bucket")
        mock_get_conn.return_value = MagicMock()
        mock_pull.return_value = None
        mock_posthog.return_value = True

        result = nightly_etl_flow.fn(target_date=target)

        assert result == target
        mock_pull.assert_called_once_with(target_date=target)
        mock_silver.assert_not_called()
        mock_posthog.assert_called_once_with(
            target_date=target,
            path="s3://test-bucket/bronze/posthog/2026/08/05/*.parquet*",
        )
        mock_gold.assert_called_once_with(target_date=target)
