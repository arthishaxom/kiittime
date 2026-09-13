"""Durable PostgreSQL Gap Ledger for terminal analytics source gaps.

The Gap Ledger is the only bespoke control state the pipeline owns: one row per
``(date, source)`` recording that a source interval will not be delivered. It is
written by idempotent upsert, so concurrent runs cannot lose or duplicate a
decision. Nothing here touches R2.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.engine import Engine

from analytics.config import Settings, get_settings
from analytics.serving import _make_engine

ANALYTICS_SCHEMA = "analytics"
POSTHOG_SOURCE = "posthog"

pipeline_gaps = sa.Table(
    "pipeline_gaps",
    sa.MetaData(),
    sa.Column("date", sa.Date),
    sa.Column("source", sa.String),
    sa.Column("reason", sa.String, nullable=False),
    sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint("date", "source"),
    schema=ANALYTICS_SCHEMA,
)


_GAP_COLUMNS = (
    pipeline_gaps.c.date,
    pipeline_gaps.c.source,
    pipeline_gaps.c.reason,
    pipeline_gaps.c.decided_at,
)


@dataclass(frozen=True)
class GapRecord:
    date: date
    source: str
    reason: str
    decided_at: datetime


class PostgresGapRepository:
    """Record, read, and reopen Terminal Gaps in PostgreSQL."""

    def __init__(self, settings: Settings | None = None, engine: Engine | None = None):
        self.settings = settings or get_settings()
        self.engine = engine or _make_engine(self.settings)

    def record_gap(self, day: date, source: str, reason: str) -> None:
        """Upsert a Terminal Gap; an existing decision is left untouched."""
        stmt = postgres_insert(pipeline_gaps).values(
            date=day,
            source=source,
            reason=reason,
            decided_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_nothing(
            index_elements=[pipeline_gaps.c.date, pipeline_gaps.c.source]
        )
        with self.engine.begin() as connection:
            connection.execute(stmt)

    def gap_for(self, day: date, source: str = POSTHOG_SOURCE) -> GapRecord | None:
        with self.engine.begin() as connection:
            row = (
                connection.execute(
                    sa.select(*_GAP_COLUMNS).where(
                        pipeline_gaps.c.date == day,
                        pipeline_gaps.c.source == source,
                    )
                )
                .mappings()
                .one_or_none()
            )
        if row is None:
            return None
        return GapRecord(**row)

    def all_gaps(self) -> list[GapRecord]:
        with self.engine.begin() as connection:
            rows = (
                connection.execute(
                    sa.select(*_GAP_COLUMNS).order_by(
                        pipeline_gaps.c.date, pipeline_gaps.c.source
                    )
                )
                .mappings()
                .all()
            )
        return [GapRecord(**row) for row in rows]

    def clear_gap(self, day: date, source: str = POSTHOG_SOURCE) -> bool:
        """Delete a gap, reopening the date; True when a row was removed."""
        with self.engine.begin() as connection:
            result = connection.execute(
                sa.delete(pipeline_gaps).where(
                    pipeline_gaps.c.date == day,
                    pipeline_gaps.c.source == source,
                )
            )
        return bool(result.rowcount)
