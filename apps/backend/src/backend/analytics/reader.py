"""Analytics serving-snapshot readers.

PostgreSQL is the request-path reader. The local R2 reader remains available
only as an explicit rollback option during the serving cutover.
"""

from __future__ import annotations

import logging
import os
import queue
import threading
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Protocol

import sqlalchemy as sa
from deltalake import DeltaTable
from sqlalchemy.engine import Engine

from backend.config import Settings, get_duckdb_conn, get_settings

from .tables import gold_daily_usage, gold_endpoint_health, gold_section_trends, sync_metadata

logger = logging.getLogger(__name__)
_reader_instances: dict[tuple[str, str, int], Any] = {}


@dataclass(frozen=True)
class DailyUsageRecord:
    date: date
    dau: int
    total_api_calls: int
    timetable_searches: int


@dataclass(frozen=True)
class EndpointHealthRecord:
    date: date
    endpoint: str
    total_calls: int
    p95_latency_ms: float
    error_rate: float


@dataclass(frozen=True)
class SectionTrendRecord:
    date: date
    section_name: str
    section_year: int
    search_volume: int


@dataclass(frozen=True)
class DashboardData:
    usage: list[DailyUsageRecord]
    endpoint_health: list[EndpointHealthRecord]
    section_trends: list[SectionTrendRecord]
    data_as_of: datetime
    synced_at: datetime
    stale: bool = False


class AnalyticsSnapshotUnavailable(RuntimeError):
    """Raised when PostgreSQL has no successful serving snapshot."""


class AnalyticsReader(Protocol):
    def dashboard(self, days: int) -> DashboardData: ...


class _FallbackReader:
    """Serve the last local-R2 result when the explicit rollback reader fails."""

    def __init__(self, primary: AnalyticsReader, max_entries: int = 4):
        self._primary = primary
        self._cache: dict[int, DashboardData] = {}
        self._lock = threading.Lock()
        self._max_entries = max_entries

    def dashboard(self, days: int) -> DashboardData:
        try:
            result = self._primary.dashboard(days)
        except Exception as exc:
            with self._lock:
                cached = self._cache.get(days)
            if cached is None:
                logger.error("analytics rollback reader unavailable days=%d", days)
                raise
            logger.warning(
                "analytics rollback reader stale fallback days=%d error_type=%s",
                days,
                type(exc).__name__,
            )
            return DashboardData(
                usage=cached.usage,
                endpoint_health=cached.endpoint_health,
                section_trends=cached.section_trends,
                data_as_of=cached.data_as_of,
                synced_at=cached.synced_at,
                stale=True,
            )
        with self._lock:
            self._cache[days] = result
            while len(self._cache) > self._max_entries:
                del self._cache[next(iter(self._cache))]
        return result


class _ConnectionPool:
    """Small pool used only by the rollback DuckDB reader."""

    def __init__(self, factory, size: int):
        self._factory = factory
        bounded_size = min(max(1, size), 4)
        self._connections = queue.LifoQueue(maxsize=bounded_size)
        self._slots = threading.BoundedSemaphore(bounded_size)

    def acquire(self):
        self._slots.acquire()
        try:
            return self._connections.get_nowait()
        except queue.Empty:
            try:
                return self._factory()
            except Exception:
                self._slots.release()
                raise

    def release(self, conn, discard: bool = False):
        try:
            if discard:
                try:
                    conn.close()
                except Exception:
                    pass
                return
            try:
                self._connections.put_nowait(conn)
            except queue.Full:
                conn.close()
        finally:
            self._slots.release()


def _utc_midnight(value: date) -> datetime:
    return datetime(value.year, value.month, value.day, tzinfo=UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class PostgresAnalyticsReader:
    """Read one consistent analytics snapshot from PostgreSQL."""

    def __init__(self, settings: Settings | None = None, engine: Engine | None = None):
        self.settings = settings or get_settings()
        if engine is not None:
            self.engine = engine
        else:
            database_url = self.settings.ANALYTICS_DATABASE_URL or os.environ.get(
                "DATABASE_URL", ""
            )
            if not database_url:
                raise ValueError("ANALYTICS_DATABASE_URL or DATABASE_URL is required")
            self.engine = sa.create_engine(
                database_url,
                pool_size=min(max(1, self.settings.ANALYTICS_POOL_SIZE), 4),
                max_overflow=0,
                pool_pre_ping=True,
            )

    def dashboard(self, days: int) -> DashboardData:
        cutoff = datetime.now(UTC).date() - timedelta(days=days)
        with self.engine.begin() as connection:
            metadata_row = (
                connection.execute(
                    sa.select(
                        sync_metadata.c.data_as_of,
                        sync_metadata.c.synced_at,
                        sync_metadata.c.expected_date,
                        sync_metadata.c.status,
                    ).where(sync_metadata.c.id == 1)
                )
                .mappings()
                .one_or_none()
            )

            if metadata_row is None or metadata_row["data_as_of"] is None:
                raise AnalyticsSnapshotUnavailable("no successful analytics snapshot")

            data_as_of = metadata_row["data_as_of"]
            synced_at = metadata_row["synced_at"]
            if synced_at is None:
                raise AnalyticsSnapshotUnavailable("analytics snapshot has no publication time")

            usage_rows = connection.execute(
                sa.select(
                    gold_daily_usage.c.date,
                    gold_daily_usage.c.dau,
                    gold_daily_usage.c.total_api_calls,
                    gold_daily_usage.c.timetable_searches,
                )
                .where(gold_daily_usage.c.date >= cutoff)
                .where(gold_daily_usage.c.date <= data_as_of)
                .order_by(gold_daily_usage.c.date)
            ).all()
            health_rows = connection.execute(
                sa.select(
                    gold_endpoint_health.c.date,
                    gold_endpoint_health.c.endpoint,
                    gold_endpoint_health.c.total_calls,
                    gold_endpoint_health.c.p95_latency_ms,
                    gold_endpoint_health.c.error_rate,
                )
                .where(gold_endpoint_health.c.date >= cutoff)
                .where(gold_endpoint_health.c.date <= data_as_of)
                .order_by(gold_endpoint_health.c.date, gold_endpoint_health.c.endpoint)
            ).all()
            trend_rows = connection.execute(
                sa.select(
                    gold_section_trends.c.date,
                    gold_section_trends.c.section_name,
                    gold_section_trends.c.section_year,
                    gold_section_trends.c.search_volume,
                )
                .where(gold_section_trends.c.date >= cutoff)
                .where(gold_section_trends.c.date <= data_as_of)
                .order_by(gold_section_trends.c.date, gold_section_trends.c.section_name)
            ).all()

        stale = metadata_row["status"] != "published" or (
            metadata_row["expected_date"] is not None and metadata_row["expected_date"] > data_as_of
        )
        return DashboardData(
            usage=[DailyUsageRecord(*row) for row in usage_rows],
            endpoint_health=[EndpointHealthRecord(*row) for row in health_rows],
            section_trends=[SectionTrendRecord(*row) for row in trend_rows],
            data_as_of=_utc_midnight(data_as_of),
            synced_at=_as_utc(synced_at),
            stale=stale,
        )


class LocalAnalyticsReader:
    """Temporary R2/Delta rollback reader; never selected by default."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._pool = _ConnectionPool(
            lambda: get_duckdb_conn(self.settings), self.settings.ANALYTICS_POOL_SIZE
        )

    def _table(self, name: str):
        base = self.settings.GOLD_BASE_PATH or f"s3://{self.settings.R2_BUCKET_NAME}/gold"
        try:
            options = None
            if base.startswith(("s3://", "r2://")) and self.settings.R2_ACCESS_KEY:
                options = {
                    "AWS_ACCESS_KEY_ID": self.settings.R2_ACCESS_KEY,
                    "AWS_SECRET_ACCESS_KEY": self.settings.R2_SECRET_KEY,
                    "AWS_ENDPOINT_URL": f"https://{self.settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com",
                    "AWS_REGION": "auto",
                }
            return DeltaTable(f"{base}/{name}", storage_options=options).to_pyarrow_table()
        except Exception as exc:
            logger.warning("analytics rollback table load failed table=%s error=%s", name, exc)
            return None

    def _query(self, name: str, columns: str, order: str, days: int) -> list[Any]:
        table = self._table(name)
        if table is None or table.num_rows == 0:
            return []
        conn = self._pool.acquire()
        failed = False
        started = time.monotonic()
        try:
            conn.register(name, table)
            cutoff = datetime.now(UTC).date() - timedelta(days=days)
            rows = conn.execute(
                f"SELECT {columns} FROM {name} WHERE date >= ? ORDER BY {order}",
                [cutoff],
            ).fetchall()
            logger.info(
                "analytics rollback query=%s rows=%d duration_ms=%.1f",
                name,
                len(rows),
                (time.monotonic() - started) * 1000,
            )
            return rows
        except Exception:
            failed = True
            raise
        finally:
            self._pool.release(conn, discard=failed)

    def dashboard(self, days: int) -> DashboardData:
        usage = [
            DailyUsageRecord(*row)
            for row in self._query(
                "gold_daily_usage",
                "CAST(date AS DATE), CAST(dau AS INTEGER), "
                "CAST(total_api_calls AS INTEGER), CAST(timetable_searches AS INTEGER)",
                "date ASC",
                days,
            )
        ]
        health = [
            EndpointHealthRecord(*row)
            for row in self._query(
                "gold_endpoint_health",
                "CAST(date AS DATE), CAST(endpoint AS VARCHAR), "
                "CAST(total_calls AS INTEGER), CAST(p95_latency_ms AS DOUBLE), "
                "CAST(error_rate AS DOUBLE)",
                "date ASC, endpoint ASC",
                days,
            )
        ]
        trends = [
            SectionTrendRecord(*row)
            for row in self._query(
                "gold_section_trends",
                "CAST(date AS DATE), CAST(section_name AS VARCHAR), "
                "CAST(section_year AS INTEGER), CAST(search_volume AS INTEGER)",
                "date ASC, section_name ASC",
                days,
            )
        ]
        dates = [r.date for r in usage] + [r.date for r in health] + [r.date for r in trends]
        data_as_of = _utc_midnight(max(dates)) if dates else datetime.now(UTC)
        return DashboardData(
            usage=usage,
            endpoint_health=health,
            section_trends=trends,
            data_as_of=data_as_of,
            synced_at=data_as_of,
        )


def reset_reader_cache() -> None:
    _reader_instances.clear()


def get_analytics_reader(settings: Settings | None = None) -> AnalyticsReader:
    settings = settings or get_settings()
    key = (
        settings.ANALYTICS_QUERY_BACKEND,
        settings.ANALYTICS_DATABASE_URL or os.environ.get("DATABASE_URL", ""),
        settings.ANALYTICS_POOL_SIZE,
    )
    if key in _reader_instances:
        return _reader_instances[key]
    if settings.ANALYTICS_QUERY_BACKEND == "postgres":
        reader: AnalyticsReader = PostgresAnalyticsReader(settings)
    elif settings.ANALYTICS_QUERY_BACKEND in {"local", "local_r2"}:
        reader = _FallbackReader(LocalAnalyticsReader(settings))
    else:
        raise ValueError("ANALYTICS_QUERY_BACKEND must be postgres or local_r2")
    _reader_instances[key] = reader
    return reader
