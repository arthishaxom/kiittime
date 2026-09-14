"""Transactional Gold-to-PostgreSQL serving synchronization."""

from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal
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

SyncStatus = Literal["published", "pending", "failed"]


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
    sa.Column("date", sa.Date),
    sa.Column("dau", sa.Integer),
    sa.Column("total_api_calls", sa.Integer),
    sa.Column("timetable_searches", sa.Integer),
    primary_key=("date",),
)
gold_endpoint_health = _serving_table(
    "gold_endpoint_health",
    sa.Column("date", sa.Date),
    sa.Column("endpoint", sa.String),
    sa.Column("total_calls", sa.Integer),
    sa.Column("p95_latency_ms", sa.Float),
    sa.Column("error_rate", sa.Float),
    primary_key=("date", "endpoint"),
)
gold_section_trends = _serving_table(
    "gold_section_trends",
    sa.Column("date", sa.Date),
    sa.Column("section_name", sa.String),
    sa.Column("section_year", sa.Integer),
    sa.Column("search_volume", sa.Integer),
    primary_key=("date", "section_name", "section_year"),
)
sync_metadata = sa.Table(
    "sync_metadata",
    sa.MetaData(),
    sa.Column("id", sa.SmallInteger, primary_key=True),
    sa.Column("data_as_of", sa.Date),
    sa.Column("synced_at", sa.DateTime(timezone=True)),
    sa.Column("expected_date", sa.Date),
    sa.Column("status", sa.String),
    sa.Column("error_message", sa.Text),
    sa.Column("updated_at", sa.DateTime(timezone=True)),
    schema=ANALYTICS_SCHEMA,
)


@dataclass(frozen=True)
class GoldSnapshot:
    daily_usage: list[dict[str, Any]]
    endpoint_health: list[dict[str, Any]]
    section_trends: list[dict[str, Any]]


@dataclass(frozen=True)
class SyncMetadata:
    data_as_of: date | None
    synced_at: datetime | None
    expected_date: date | None
    status: SyncStatus
    error_message: str | None


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
    """Own the serving publication transaction and sync state transitions."""

    def __init__(self, settings: Settings | None = None, engine: Engine | None = None):
        self.settings = settings or get_settings()
        self.engine = engine or _make_engine(self.settings)

    def metadata(self) -> SyncMetadata | None:
        with self.engine.begin() as connection:
            row = (
                connection.execute(
                    sa.select(
                        sync_metadata.c.data_as_of,
                        sync_metadata.c.synced_at,
                        sync_metadata.c.expected_date,
                        sync_metadata.c.status,
                        sync_metadata.c.error_message,
                    ).where(sync_metadata.c.id == 1)
                )
                .mappings()
                .one_or_none()
            )
        if row is None:
            return None
        return SyncMetadata(**row)

    def has_successful_snapshot(self) -> bool:
        current = self.metadata()
        return (
            current is not None and current.status == "published" and current.data_as_of is not None
        )

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

    def _metadata_upsert(
        self,
        connection,
        *,
        data_as_of: date | None,
        synced_at: datetime | None,
        expected_date: date | None,
        status: SyncStatus,
        error_message: str | None,
    ) -> None:
        values = {
            "id": 1,
            "data_as_of": data_as_of,
            "synced_at": synced_at,
            "expected_date": expected_date,
            "status": status,
            "error_message": error_message,
            "updated_at": datetime.now(UTC),
        }
        stmt = postgres_insert(sync_metadata).values(values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[sync_metadata.c.id],
            set_={key: value for key, value in values.items() if key != "id"},
        )
        connection.execute(stmt)

    def mark_pending(self, expected_date: date) -> None:
        with self.engine.begin() as connection:
            current_row = (
                connection.execute(
                    sa.select(
                        sync_metadata.c.data_as_of,
                        sync_metadata.c.synced_at,
                    ).where(sync_metadata.c.id == 1).with_for_update()
                )
                .mappings()
                .one_or_none()
            )
            self._metadata_upsert(
                connection,
                data_as_of=current_row["data_as_of"] if current_row else None,
                synced_at=current_row["synced_at"] if current_row else None,
                expected_date=expected_date,
                status="pending",
                error_message=None,
            )

    def mark_failed(self, expected_date: date, error: Exception | str) -> None:
        message = str(error)[:1000]
        try:
            with self.engine.begin() as connection:
                current_row = (
                    connection.execute(
                        sa.select(
                            sync_metadata.c.data_as_of,
                            sync_metadata.c.synced_at,
                        ).where(sync_metadata.c.id == 1).with_for_update()
                    )
                    .mappings()
                    .one_or_none()
                )
                self._metadata_upsert(
                    connection,
                    data_as_of=current_row["data_as_of"] if current_row else None,
                    synced_at=current_row["synced_at"] if current_row else None,
                    expected_date=expected_date,
                    status="failed",
                    error_message=message,
                )
        except Exception:
            logger.exception("unable to record analytics serving failure")

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
        data_as_of: date,
        replace_all: bool | None = None,
        rebuild: bool | None = None,
        authoritative_empty: bool = False,
    ) -> datetime:
        """Atomically replace changed serving dates and publish sync metadata.

        Empty health/trends lists never delete prior rows unless
        ``authoritative_empty`` is set, in which case ``expected_date`` is
        cleared for those tables (confirmed empty reprocess).
        """
        if rebuild is None:
            rebuild = bool(replace_all) if replace_all is not None else False
        table_rows: tuple[tuple[sa.Table, list[dict[str, Any]]], ...] = (
            (gold_daily_usage, snapshot.daily_usage),
            (gold_endpoint_health, snapshot.endpoint_health),
            (gold_section_trends, snapshot.section_trends),
        )
        synced_at = datetime.now(UTC)
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
            self._upsert(connection, gold_daily_usage, snapshot.daily_usage)
            self._upsert(connection, gold_endpoint_health, snapshot.endpoint_health)
            self._upsert(connection, gold_section_trends, snapshot.section_trends)
            self._metadata_upsert(
                connection,
                data_as_of=data_as_of,
                synced_at=synced_at,
                expected_date=expected_date,
                status="published",
                error_message=None,
            )
        return synced_at


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
) -> datetime:
    """Publish complete Gold data or one reprocessed date to PostgreSQL."""
    settings = settings or get_settings()
    if target_date is None:
        target_date = (datetime.now(IST_TIMEZONE) - timedelta(days=1)).date()
    repository = repository or PostgresServingRepository(settings)
    if rebuild is None:
        rebuild = not repository.has_successful_snapshot()

    snapshot = read_gold_snapshot(settings, None if rebuild else target_date)
    if not snapshot.daily_usage:
        raise RuntimeError(f"Gold daily usage has no complete row for {target_date}")

    current = repository.metadata()
    source_dates = [row["date"] for row in snapshot.daily_usage]
    data_as_of = max(source_dates)
    if not rebuild and current and current.data_as_of:
        data_as_of = max(data_as_of, current.data_as_of)

    return repository.publish(
        snapshot,
        expected_date=target_date,
        data_as_of=data_as_of,
        rebuild=rebuild,
    )
