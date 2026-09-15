"""Tests for the nightly ETL and serving publication flow."""

import logging
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from analytics.flows.nightly_etl import nightly_etl_flow
from analytics.gaps import POSTHOG_SOURCE, GapRecord
from analytics.tasks.posthog import PostHogDelivery, SourceState


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        R2_BUCKET_NAME="test-bucket",
        ANALYTICS_WRITER_DATABASE_URL="postgresql://test",
        ANALYTICS_DATABASE_URL="",
        DATABASE_URL="",
        ANALYTICS_POOL_SIZE=4,
        POSTHOG_WARN_AFTER_DAYS=2,
        POSTHOG_ABANDON_AFTER_DAYS=7,
    )


def _repos(
    *,
    oldest_served: date | None = None,
    served: set[date] | None = None,
    gapped: set[date] | None = None,
) -> tuple[MagicMock, MagicMock]:
    repository = MagicMock()
    repository.oldest_served_date.return_value = oldest_served
    repository.served_dates.return_value = served or set()
    gap_repository = MagicMock()
    gap_repository.all_gaps.return_value = [
        GapRecord(day, POSTHOG_SOURCE, "no export", datetime.now(UTC))
        for day in sorted(gapped or set())
    ]
    return repository, gap_repository


def _aug(day: int) -> date:
    return date(2026, 8, day)


def _days(start: date, count: int) -> set[date]:
    return {start + timedelta(days=offset) for offset in range(count)}


@contextmanager
def _patches(repository: MagicMock, gap_repository: MagicMock):
    with (
        patch("analytics.flows.nightly_etl.get_settings", return_value=_settings()),
        patch("analytics.flows.nightly_etl.PostgresServingRepository", return_value=repository),
        patch("analytics.flows.nightly_etl.PostgresGapRepository", return_value=gap_repository),
    ):
        yield


def test_nightly_etl_flow_publishes_complete_date():
    target = _aug(5)
    repository, gap_repository = _repos()
    delivery = PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver") as silver,
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as gold,
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    silver.assert_called_once()
    assert gold.call_args.kwargs["target_date"] == target
    assert gold.call_args.kwargs["posthog_status"] == SourceState.DATA
    sync.assert_called_once()
    assert sync.call_args.kwargs["target_date"] == target
    gap_repository.record_gap.assert_not_called()


def test_nightly_etl_flow_publishes_confirmed_empty_date():
    target = _aug(5)
    repository, gap_repository = _repos()
    delivery = PostHogDelivery(SourceState.EMPTY, row_count=0, detail="PostHog interval is empty")
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold") as gold,
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    assert gold.call_args.kwargs["posthog_status"] == SourceState.EMPTY
    sync.assert_called_once()
    gap_repository.record_gap.assert_not_called()


def test_nightly_etl_flow_skips_served_and_gapped_dates():
    target = _aug(7)
    served = _days(date(2026, 7, 31), 5) | {_aug(6)}
    repository, gap_repository = _repos(
        oldest_served=date(2026, 7, 31),
        served=served,
        gapped={_aug(5)},
    )
    delivery = PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery) as check,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold"),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    check.assert_called_once()
    assert check.call_args.kwargs["target_date"] == target
    sync.assert_called_once()
    gap_repository.record_gap.assert_not_called()


def test_nightly_etl_flow_does_nothing_when_all_dates_accounted():
    target = _aug(7)
    served = _days(date(2026, 7, 31), 8)
    repository, gap_repository = _repos(oldest_served=date(2026, 7, 31), served=served)
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.check_posthog_files") as check,
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    check.assert_not_called()
    sync.assert_not_called()


def test_nightly_etl_flow_warns_inside_window_without_terminal_gap(caplog):
    target = _aug(7)
    pending = _aug(5)
    served = _days(date(2026, 7, 31), 5) | {_aug(6)}
    repository, gap_repository = _repos(
        oldest_served=date(2026, 7, 31),
        served=served,
    )

    def delivery(*, target_date: date, **_: object) -> PostHogDelivery:
        if target_date == pending:
            return PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
        return PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)

    with (
        _patches(repository, gap_repository),
        caplog.at_level(logging.WARNING, logger="analytics.flows.nightly_etl"),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", side_effect=delivery),
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold"),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    gap_repository.record_gap.assert_not_called()
    sync.assert_called_once()
    assert sync.call_args.kwargs["target_date"] == target
    assert any("2026-08-05" in record.getMessage() for record in caplog.records)


def test_nightly_etl_flow_abandons_past_threshold_with_one_gap_row():
    target = _aug(12)
    abandoned = _aug(5)
    served = _days(_aug(6), 7)
    repository, gap_repository = _repos(oldest_served=_aug(6), served=served)
    delivery = PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    gap_repository.record_gap.assert_called_once()
    day, source, reason = gap_repository.record_gap.call_args.args
    assert day == abandoned
    assert source == POSTHOG_SOURCE
    assert "7 days" in reason
    sync.assert_not_called()


def test_nightly_etl_flow_does_not_rerecord_an_existing_gap():
    target = _aug(12)
    abandoned = _aug(5)
    served = _days(_aug(6), 7)
    repository, gap_repository = _repos(oldest_served=_aug(6), served=served)
    delivery = PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery) as check,
    ):
        first = nightly_etl_flow.fn(target_date=target)
        gap_repository.all_gaps.return_value = [
            GapRecord(abandoned, POSTHOG_SOURCE, "no export", datetime.now(UTC))
        ]
        second = nightly_etl_flow.fn(target_date=target)

    assert first == target
    assert second == target
    gap_repository.record_gap.assert_called_once()
    assert check.call_count == 1


def test_nightly_etl_flow_continues_past_pending_to_newer_dates():
    older = _aug(5)
    newer = _aug(7)
    served = _days(date(2026, 7, 31), 5) | {_aug(6)}
    repository, gap_repository = _repos(
        oldest_served=date(2026, 7, 31),
        served=served,
    )

    def delivery(*, target_date: date, **_: object) -> PostHogDelivery:
        if target_date == older:
            return PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
        return PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)

    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=newer),
        patch("analytics.flows.nightly_etl.check_posthog_files", side_effect=delivery),
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold"),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=newer)

    assert result == newer
    sync.assert_called_once()
    assert sync.call_args.kwargs["target_date"] == newer
    gap_repository.record_gap.assert_not_called()


def test_nightly_etl_flow_catches_up_every_unaccounted_date():
    target = _aug(10)
    served = _days(_aug(1), 3)
    repository, gap_repository = _repos(oldest_served=_aug(1), served=served)
    delivery = PostHogDelivery(SourceState.DATA, file_count=1, row_count=3)
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=target),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery) as check,
        patch("analytics.flows.nightly_etl.transform_bronze_to_silver"),
        patch("analytics.flows.nightly_etl.transform_silver_to_gold"),
        patch("analytics.flows.nightly_etl.sync_gold_to_postgres") as sync,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    attempted = [call.kwargs["target_date"] for call in check.call_args_list]
    assert attempted == [_aug(4) + timedelta(days=offset) for offset in range(7)]
    assert sync.call_count == 7


def test_nightly_etl_flow_gaps_pending_date_older_than_the_retry_window():
    target = _aug(25)
    served = _days(_aug(1), 10) | _days(_aug(12), 14)
    repository, gap_repository = _repos(oldest_served=_aug(1), served=served)
    delivery = PostHogDelivery(SourceState.PENDING, detail="export has not arrived")
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery) as check,
    ):
        result = nightly_etl_flow.fn(target_date=target)

    assert result == target
    check.assert_called_once()
    assert check.call_args.kwargs["target_date"] == _aug(11)
    gap_repository.record_gap.assert_called_once()
    assert gap_repository.record_gap.call_args.args[0] == _aug(11)


def test_nightly_etl_flow_raises_on_failed_delivery_without_recording_a_gap():
    target = _aug(5)
    repository, gap_repository = _repos()
    delivery = PostHogDelivery(SourceState.FAILED, detail="source error")
    with (
        _patches(repository, gap_repository),
        patch("analytics.flows.nightly_etl.pull_axiom_logs", return_value=None),
        patch("analytics.flows.nightly_etl.check_posthog_files", return_value=delivery),
    ):
        try:
            nightly_etl_flow.fn(target_date=target)
        except RuntimeError as exc:
            assert "source error" in str(exc)
        else:
            raise AssertionError("failed delivery must fail the flow")

    gap_repository.record_gap.assert_not_called()
