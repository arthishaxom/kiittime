"""Tests for the durable PostgreSQL Gap Ledger."""

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
import sqlalchemy as sa

from analytics.config import Settings
from analytics.gaps import (
    POSTHOG_SOURCE,
    PostgresGapRepository,
    pipeline_gaps,
)

TABLES = (pipeline_gaps,)


def _pg_url() -> str | None:
    return (
        os.environ.get("ANALYTICS_WRITER_DATABASE_URL")
        or os.environ.get("ANALYTICS_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        or "postgresql+psycopg://kiittime_app:localdev@localhost:5432/kiittime_dev"
    )


def _settings(url: str) -> Settings:
    return Settings(
        ANALYTICS_WRITER_DATABASE_URL=url,
        ANALYTICS_POOL_SIZE=2,
        R2_BUCKET_NAME="test-bucket",
    )


@pytest.fixture
def repository():
    url = _pg_url()
    assert url
    repo = PostgresGapRepository(_settings(url))
    try:
        with repo.engine.begin() as conn:
            conn.execute(sa.text("SELECT 1"))
    except Exception as exc:
        repo.engine.dispose()
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    for table in TABLES:
        table.metadata.create_all(repo.engine, checkfirst=True)
    with repo.engine.begin() as conn:
        for table in TABLES:
            conn.execute(table.delete())
    yield repo
    with repo.engine.begin() as conn:
        for table in TABLES:
            conn.execute(table.delete())
    repo.engine.dispose()


def test_record_then_read_roundtrips(repository):
    day = date(2026, 8, 4)

    repository.record_gap(day, POSTHOG_SOURCE, "no export arrived")

    gap = repository.gap_for(day, POSTHOG_SOURCE)
    assert gap is not None
    assert gap.date == day
    assert gap.source == POSTHOG_SOURCE
    assert gap.reason == "no export arrived"
    assert gap.decided_at.tzinfo is not None


def test_all_gaps_returns_every_record_ordered(repository):
    older, newer = date(2026, 8, 3), date(2026, 8, 4)
    repository.record_gap(newer, POSTHOG_SOURCE, "newer")
    repository.record_gap(older, POSTHOG_SOURCE, "older")

    gaps = repository.all_gaps()

    assert [(gap.date, gap.reason) for gap in gaps] == [(older, "older"), (newer, "newer")]


def test_gap_for_missing_date_returns_none(repository):
    assert repository.gap_for(date(2026, 8, 4)) is None


def test_recording_same_gap_twice_stays_single(repository):
    day = date(2026, 8, 4)
    repository.record_gap(day, POSTHOG_SOURCE, "no export arrived")
    repository.record_gap(day, POSTHOG_SOURCE, "no export arrived")

    assert len(repository.all_gaps()) == 1


def test_rerecord_leaves_the_first_decision_untouched(repository):
    day = date(2026, 8, 4)
    repository.record_gap(day, POSTHOG_SOURCE, "first reason")
    first = repository.gap_for(day)
    assert first is not None

    time.sleep(0.01)
    repository.record_gap(day, POSTHOG_SOURCE, "second reason")
    second = repository.gap_for(day)

    assert second is not None
    assert second.reason == "first reason"
    assert second.decided_at == first.decided_at


def test_sources_are_independent_for_one_date(repository):
    day = date(2026, 8, 4)
    repository.record_gap(day, POSTHOG_SOURCE, "no export")
    repository.record_gap(day, "axiom", "no logs")

    assert len(repository.all_gaps()) == 2
    assert repository.clear_gap(day, POSTHOG_SOURCE) is True
    assert repository.gap_for(day, POSTHOG_SOURCE) is None
    remaining = repository.gap_for(day, "axiom")
    assert remaining is not None and remaining.source == "axiom"


def test_reopen_clears_the_gap(repository):
    day = date(2026, 8, 4)
    repository.record_gap(day, POSTHOG_SOURCE, "no export arrived")

    assert repository.clear_gap(day, POSTHOG_SOURCE) is True
    assert repository.gap_for(day) is None
    assert repository.all_gaps() == []
    assert repository.clear_gap(day, POSTHOG_SOURCE) is False


def test_concurrent_records_do_not_duplicate(repository):
    day = date(2026, 8, 4)
    barrier = threading.Barrier(2)
    failures: list[Exception] = []

    def record(reason: str) -> None:
        barrier.wait()
        try:
            repository.record_gap(day, POSTHOG_SOURCE, reason)
        except Exception as exc:  # pragma: no cover - only on regression
            failures.append(exc)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(record, ("first", "second")))

    assert failures == []
    assert [gap.date for gap in repository.all_gaps()] == [day]
