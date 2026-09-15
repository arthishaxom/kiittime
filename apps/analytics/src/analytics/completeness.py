"""Artifact-derived completeness for the nightly analytics flow.

A calendar date is done when it is present in the Analytics Serving Snapshot
(``gold_daily_usage``) or recorded as a Terminal Gap in the Gap Ledger. The
flow derives the dates still worth processing from those two artifacts; no
per-stage status table is consulted. A Terminal Gap is never reprocessed on
its own, but it is re-checked for a late source arrival so it can be reopened
when the export finally arrives.
"""

from __future__ import annotations

from datetime import date, timedelta

from analytics.gaps import POSTHOG_SOURCE, GapRecord, PostgresGapRepository
from analytics.serving import PostgresServingRepository


def _dates_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def get_pending_dates(
    served_repository: PostgresServingRepository,
    gap_repository: PostgresGapRepository,
    target_date: date,
    abandon_after_days: int,
    source: str = POSTHOG_SOURCE,
) -> list[date]:
    """Return unaccounted-for dates for ``source``, oldest first.

    The scan starts at the oldest Accounted-for Date, so a date that is pending
    while newer dates are served can never fall out of the scan before it is
    abandoned. It also reaches back ``abandon_after_days`` from ``target_date``
    to cover dates that predate the first accounted one. A fresh deployment
    with no accounted dates scans only the requested date.
    """
    gaps = [gap for gap in gap_repository.all_gaps() if gap.source == source]
    oldest_served = served_repository.oldest_served_date()
    oldest_gap = min((gap.date for gap in gaps), default=None)
    accounted = [day for day in (oldest_served, oldest_gap) if day is not None]
    if accounted:
        start = min(min(accounted), target_date - timedelta(days=abandon_after_days))
    else:
        start = target_date

    served = served_repository.served_dates(start, target_date)
    gapped = {gap.date for gap in gaps if start <= gap.date <= target_date}
    return [
        day for day in _dates_between(start, target_date) if day not in served and day not in gapped
    ]


def get_reopen_candidates(
    gap_repository: PostgresGapRepository,
    target_date: date,
    source: str = POSTHOG_SOURCE,
) -> list[GapRecord]:
    """Recorded Terminal Gaps at or before ``target_date``, oldest first.

    A gapped date is terminal and never retried, but its source can arrive
    late, so every gap stays a candidate for a re-check and possible reopen.
    """
    return [
        gap
        for gap in gap_repository.all_gaps()
        if gap.source == source and gap.date <= target_date
    ]
