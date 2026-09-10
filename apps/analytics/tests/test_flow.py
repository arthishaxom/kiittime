"""Tests for the nightly ETL and serving publication flow."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from analytics.flows.nightly_etl import nightly_etl_flow
from analytics.tasks.posthog import PostHogDelivery, SourceState


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        R2_BUCKET_NAME="test-bucket",
        ANALYTICS_WRITER_DATABASE_URL="postgresql://test",
        ANALYTICS_DATABASE_URL="",
        DATABASE_URL="",
        ANALYTICS_POOL_SIZE=4,
    )


def test_nightly_etl_flow_publishes_complete_date():
    target = date(2026, 8, 5)
    repository = MagicMock()
    repository.has_successful_snapshot.return_value = False
    delivery = PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)
    with (
        patch("analytics.flows.nightly_etl.get_settings", return_value=_settings()),
        patch("analytics.flows.nightly_etl.get_duckdb_conn", return_value=MagicMock()),
        patch("analytics.flows.nightly_etl.PostgresServingRepository", return_value=repository),
        patch("analytics.flows.nightly_etl.get_pending_dates", return_value=[target]),
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold"),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres"),
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    repository.mark_failed.assert_not_called()


def test_nightly_etl_flow_keeps_snapshot_stale_when_posthog_is_pending():
    target = date(2026, 8, 5)
    repository = MagicMock()
    delivery = PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
    with (
        patch("analytics.flows.nightly_etl.get_settings", return_value=_settings()),
        patch("analytics.flows.nightly_etl.get_duckdb_conn", return_value=MagicMock()),
        patch("analytics.flows.nightly_etl.PostgresServingRepository", return_value=repository),
        patch("analytics.flows.nightly_etl.get_pending_dates", return_value=[target]),
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=None),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as gold,
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        nightly_etl_flow.fn(target_date=target)

    repository.mark_pending.assert_called_once_with(target)
    gold.assert_not_called()
    sync.assert_not_called()


def test_nightly_etl_flow_marks_failed_delivery_operator_visible():
    target = date(2026, 8, 5)
    repository = MagicMock()
    delivery = PostHogDelivery(SourceState.FAILED, detail="source error")
    with (
        patch("analytics.flows.nightly_etl.get_settings", return_value=_settings()),
        patch("analytics.flows.nightly_etl.get_duckdb_conn", return_value=MagicMock()),
        patch("analytics.flows.nightly_etl.PostgresServingRepository", return_value=repository),
        patch("analytics.flows.nightly_etl.get_pending_dates", return_value=[target]),
        patch("analytics.flows.nightly_etl.stage_succeeded", return_value=False),
        patch("analytics.flows.nightly_etl.mark_stage"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=None),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
    ):
        try:
            nightly_etl_flow.fn(target_date=target)
        except RuntimeError as exc:
            assert "source error" in str(exc)
        else:
            raise AssertionError("failed delivery must fail the flow")

    repository.mark_failed.assert_called_once()
