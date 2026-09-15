"""Transactional Gold-to-PostgreSQL serving synchronization."""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import sqlalchemy as sa
from deltalake import DeltaTable
from prefect import task
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.engine import Engine

from analytics.config import Settings, get_settings

logger = logging.getLogger(__name__)
IST_TIMEZONE = ZoneInfo("Asia/Kolkata")
ANALYTICS_SCHEMA = "analytics"


def _serving_table(name: str, *columns: sa.Column, primary_key: Sequence[str]) -> sa.Table:
    return sa.Table(
        name,
        sa.MetaData(),
        *columns,
        sa.PrimaryKeyConstraint(*primary_key),
        schema=ANALYTICS_SCHEMA,
    )


gold_daily_usage = _serving_table(
    "gold_daily_usage",
    sa.Column("date", sa.Date, nullable=False),
    sa.Column("dau", sa.Integer, nullable=False),
    sa.Column("total_api_calls", sa.Integer, nullable=False),
    sa.Column("timetable_searches", sa.Integer, nullable=False),
    sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
    primary_key=("date",),
)
gold_endpoint_health = _serving_table(
    "gold_endpoint_health",
    sa.Column("date", sa.Date, nullable=False),
    sa.Column("endpoint", sa.String, nullable=False),
    sa.Column("total_calls", sa.Integer, nullable=False),
    sa.Column("p95_latency_ms", sa.Float, nullable=False),
    sa.Column("error_rate", sa.Float, nullable=False),
    sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
    primary_key=("date", "endpoint"),
)
gold_section_trends = _serving_table(
    "gold_section_trends",
    sa.Column("date", sa.Date, nullable=False),
    sa.Column("section_name", sa.String, nullable=False),
    sa.Column("section_year", sa.Integer, nullable=False),
    sa.Column("search_volume", sa.Integer, nullable=False),
    sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
    primary_key=("date", "section_name", "section_year"),
)


@dataclass(frozen=True)
class GoldSnapshot:
    daily_usage: list[dict[str, Any]]
    endpoint_health: list[dict[str, Any]]
    section_trends: list[dict[str, Any]]


def _is_prod(settings: Settings) -> bool:
    env = getattr(settings, "ENVIRONMENT", "") or os.environ.get(
        "ENVIRONMENT", os.environ.get("ENV", "dev")
    )
    return str(env).lower() in ("prod", "production")


def _writer_database_url(settings: Settings) -> str:
    if settings.ANALYTICS_WRITER_DATABASE_URL:
        return settings.ANALYTICS_WRITER_DATABASE_URL
    if _is_prod(settings):
        raise ValueError(
            "ANALYTICS_WRITER_DATABASE_URL is required in production "
            "(shared-URL fallback is dev-only)"
        )
    logger.warning("ANALYTICS_WRITER_DATABASE_URL unset, falling back to shared DATABASE_URL")
    database_url = (
        settings.ANALYTICS_DATABASE_URL
        or settings.DATABASE_URL
        or os.environ.get("DATABASE_URL", "")
    )
    if not database_url:
        raise ValueError(
            "ANALYTICS_WRITER_DATABASE_URL, ANALYTICS_DATABASE_URL, or DATABASE_URL is required"
        )
    return database_url


def _make_engine(settings: Settings) -> Engine:
    # Shared Aiven Free budget (20 conns): backend main 4 + reader 2 + worker 2 per process.
    return sa.create_engine(
        _writer_database_url(settings),
        pool_size=min(max(1, settings.ANALYTICS_POOL_SIZE), 2),
        max_overflow=0,
        pool_pre_ping=True,
    )


class PostgresServingRepository:
    """Own the serving publication transaction."""

    def __init__(self, settings: Settings | None = None, engine: Engine | None = None):
        self.settings = settings or get_settings()
        self.engine = engine or _make_engine(self.settings)

    def served_dates(self, start: date, end: date) -> set[date]:
        """Gold dates present in the serving snapshot within ``[start, end]``."""
        with self.engine.begin() as connection:
            rows = connection.execute(
                sa.select(gold_daily_usage.c.date).where(
                    gold_daily_usage.c.date.between(start, end)
                )
            ).scalars()
            return set(rows)

    def oldest_served_date(self) -> date | None:
        """Earliest date present in the serving snapshot, or ``None`` when empty."""
        with self.engine.begin() as connection:
            return connection.execute(sa.select(sa.func.min(gold_daily_usage.c.date))).scalar()

    @staticmethod
    def _stamp(rows: list[dict[str, Any]], published_at: datetime) -> list[dict[str, Any]]:
        return [{**row, "published_at": published_at} for row in rows]

    @staticmethod
    def _upsert(connection, table: sa.Table, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        stmt = postgres_insert(table).values(rows)
        key_names = {column.name for column in table.primary_key.columns}
        update_values = {
            column.name: getattr(stmt.excluded, column.name)
            for column in table.columns
            if column.name not in key_names
        }
        connection.execute(
            stmt.on_conflict_do_update(
                index_elements=[table.c[name] for name in key_names],
                set_=update_values,
            )
        )

    def publish(
        self,
        snapshot: GoldSnapshot,
        *,
        expected_date: date,
        replace_all: bool | None = None,
        rebuild: bool | None = None,
        authoritative_empty: bool = False,
    ) -> datetime:
        """Atomically replace changed serving dates, stamped at one instant.

        Every row written by this call carries the same ``published_at``, which
        the read path reports as ``synced_at``. Empty health/trends lists never
        delete prior rows unless ``authoritative_empty`` is set, in which case
        rows dated ``expected_date`` are deleted for those tables (confirmed
        empty reprocess).
        """
        if rebuild is None:
            rebuild = bool(replace_all) if replace_all is not None else False
        table_rows: tuple[tuple[sa.Table, list[dict[str, Any]]], ...] = (
            (gold_daily_usage, snapshot.daily_usage),
            (gold_endpoint_health, snapshot.endpoint_health),
            (gold_section_trends, snapshot.section_trends),
        )
        published_at = datetime.now(UTC)
        with self.engine.begin() as connection:
            for table, rows in table_rows:
                if rebuild:
                    connection.execute(table.delete())
                else:
                    table_dates = {row["date"] for row in rows}
                    if not rows and authoritative_empty:
                        table_dates.add(expected_date)
                    if not table_dates:
                        continue
                    connection.execute(table.delete().where(table.c.date.in_(table_dates)))
            self._upsert(
                connection, gold_daily_usage, self._stamp(snapshot.daily_usage, published_at)
            )
            self._upsert(
                connection,
                gold_endpoint_health,
                self._stamp(snapshot.endpoint_health, published_at),
            )
            self._upsert(
                connection,
                gold_section_trends,
                self._stamp(snapshot.section_trends, published_at),
            )
        return published_at


def _storage_options(settings: Settings) -> dict[str, str] | None:
    if not (settings.R2_ACCESS_KEY and settings.R2_SECRET_KEY and settings.CF_ACCOUNT_ID):
        return None
    return {
        "AWS_ACCESS_KEY_ID": settings.R2_ACCESS_KEY,
        "AWS_SECRET_ACCESS_KEY": settings.R2_SECRET_KEY,
        "AWS_ENDPOINT_URL": f"https://{settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
        "AWS_REGION": "auto",
        "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
    }


def _gold_table_path(settings: Settings, table_name: str) -> str:
    base = settings.GOLD_BASE_PATH or f"s3://{settings.R2_BUCKET_NAME}/gold"
    return f"{base}/{table_name}"


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    return value


def _read_gold_table(
    settings: Settings,
    table_name: str,
    target_date: date | None,
) -> list[dict[str, Any]]:
    path = _gold_table_path(settings, table_name)
    try:
        table = DeltaTable(path, storage_options=_storage_options(settings)).to_pyarrow_table()
    except Exception as exc:
        if target_date is not None and table_name != "gold_daily_usage":
            logger.info("gold table absent for target date table=%s", table_name)
            return []
        raise RuntimeError(f"Gold table is unavailable: {path}") from exc
    rows = table.to_pylist()
    if target_date is not None:
        rows = [row for row in rows if _as_date(row["date"]) == target_date]
    for row in rows:
        row["date"] = _as_date(row["date"])
    return rows


def read_gold_snapshot(settings: Settings, target_date: date | None = None) -> GoldSnapshot:
    return GoldSnapshot(
        daily_usage=_read_gold_table(settings, "gold_daily_usage", target_date),
        endpoint_health=_read_gold_table(settings, "gold_endpoint_health", target_date),
        section_trends=_read_gold_table(settings, "gold_section_trends", target_date),
    )


@task(retries=3, retry_delay_seconds=60)
def sync_gold_to_postgres(
    target_date: date | None = None,
    settings: Settings | None = None,
    repository: PostgresServingRepository | None = None,
    rebuild: bool | None = None,
    authoritative_empty: bool = False,
) -> datetime:
    """Publish complete Gold data or one reprocessed date to PostgreSQL.

    ``authoritative_empty`` marks a confirmed-empty reprocess: rows dated
    ``target_date`` are removed from the health/trends serving tables when Gold
    carries none for that date.
    """
    settings = settings or get_settings()
    if target_date is None:
        target_date = (datetime.now(IST_TIMEZONE) - timedelta(days=1)).date()
    repository = repository or PostgresServingRepository(settings)
    if rebuild is None:
        rebuild = repository.oldest_served_date() is None

    snapshot = read_gold_snapshot(settings, None if rebuild else target_date)
    if not snapshot.daily_usage:
        raise RuntimeError(f"Gold daily usage has no complete row for {target_date}")

    return repository.publish(
        snapshot,
        expected_date=target_date,
        rebuild=rebuild,
        authoritative_empty=authoritative_empty,
    )
