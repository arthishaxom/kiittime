"""Tests for nightly_etl Prefect flow."""

from datetime import date
from unittest.mock import patch

from analytics.flows.nightly_etl import nightly_etl_flow


def test_nightly_etl_flow_explicit_date():
    target = date(2026, 8, 5)
    with (
        patch("analytics.flows.nightly_etl.pull_axiom_logs") as mock_pull,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as mock_silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as mock_gold,
    ):
        mock_pull.return_value = target
        mock_silver.return_value = target
        mock_gold.return_value = target

        result = nightly_etl_flow.fn(target_date=target)

        assert result == target
        mock_pull.assert_called_once_with(target_date=target)
        mock_silver.assert_called_once_with(target_date=target)
        mock_gold.assert_called_once_with(target_date=target)


def test_nightly_etl_flow_default_date():
    with (
        patch("analytics.flows.nightly_etl.pull_axiom_logs") as mock_pull,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as mock_silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as mock_gold,
    ):
        mock_pull.side_effect = lambda target_date: target_date

        result = nightly_etl_flow.fn()

        assert isinstance(result, date)
        mock_pull.assert_called_once()
        mock_silver.assert_called_once_with(target_date=result)
        mock_gold.assert_called_once_with(target_date=result)
