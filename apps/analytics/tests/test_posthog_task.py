"""Unit tests for the PostHog source completeness task."""

from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

from analytics.config import Settings
from analytics.tasks.posthog import SourceState, check_posthog_files


def _settings(**overrides) -> Settings:
    values = {"R2_BUCKET_NAME": "test-bucket", "POSTHOG_EMPTY_DATES": ""}
    values.update(overrides)
    return Settings(**values)


def _missing_path(tmp_path: Path) -> str:
    return str(tmp_path / "bronze" / "posthog" / "*.parquet*")


def test_fileless_interval_is_pending_without_querying_the_source(tmp_path):
    verifier = MagicMock()
    verifier.count_events.return_value = 0

    delivery = check_posthog_files(
        target_date=date(2026, 8, 5),
        path=_missing_path(tmp_path),
        settings=_settings(),
        verifier=verifier,
        use_verifier=False,
    )

    assert delivery.state is SourceState.PENDING
    verifier.count_events.assert_not_called()


def test_fileless_interval_uses_the_verifier_by_default(tmp_path):
    verifier = MagicMock()
    verifier.count_events.return_value = 0

    delivery = check_posthog_files(
        target_date=date(2026, 8, 5),
        path=_missing_path(tmp_path),
        settings=_settings(),
        verifier=verifier,
    )

    assert delivery.state is SourceState.EMPTY
    verifier.count_events.assert_called_once()


def test_fileless_interval_can_still_be_attested_empty(tmp_path):
    verifier = MagicMock()

    delivery = check_posthog_files(
        target_date=date(2026, 8, 5),
        path=_missing_path(tmp_path),
        settings=_settings(POSTHOG_EMPTY_DATES="2026-08-05"),
        verifier=verifier,
        use_verifier=False,
    )

    assert delivery.state is SourceState.EMPTY
    verifier.count_events.assert_not_called()
