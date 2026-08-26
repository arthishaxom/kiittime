"""Backend-independent analytics compute seam.

Only predefined queries are exposed; callers never receive a database handle.
"""

from __future__ import annotations

import logging
import queue
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import duckdb
from deltalake import DeltaTable

from backend.config import Settings, get_duckdb_conn, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DashboardData:
    usage: list[tuple[Any, ...]]
    endpoint_health: list[tuple[Any, ...]]
    section_trends: list[tuple[Any, ...]]
    data_as_of: datetime
    stale: bool = False


class AnalyticsReader(Protocol):
    def dashboard(self, days: int) -> DashboardData: ...


class _ConnectionPool:
    def __init__(self, factory, size: int):
        self._factory = factory
        self._connections = queue.LifoQueue(maxsize=max(1, size))
        self._size = max(1, size)

    def acquire(self):
        try:
            return self._connections.get_nowait()
        except queue.Empty:
            return self._factory()

    def release(self, conn):
        try:
            self._connections.put_nowait(conn)
        except queue.Full:
            conn.close()


class LocalAnalyticsReader:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._pool = _ConnectionPool(lambda: get_duckdb_conn(self.settings), self.settings.ANALYTICS_POOL_SIZE)

    def _table(self, name: str):
        base = self.settings.GOLD_BASE_PATH or f"s3://{self.settings.R2_BUCKET_NAME}/gold"
        try:
            options = None
            if base.startswith(("s3://", "r2://")) and self.settings.R2_ACCESS_KEY:
                options = {"AWS_ACCESS_KEY_ID": self.settings.R2_ACCESS_KEY, "AWS_SECRET_ACCESS_KEY": self.settings.R2_SECRET_KEY,
                           "AWS_ENDPOINT_URL": f"https://{self.settings.CF_ACCOUNT_ID}.r2.cloudflarestorage.com", "AWS_REGION": "auto"}
            return DeltaTable(f"{base}/{name}", storage_options=options).to_pyarrow_table()
        except Exception as exc:
            logger.warning("analytics table load failed table=%s error=%s", name, exc)
            return None

    def _query(self, name: str, columns: str, order: str, days: int):
        table = self._table(name)
        if table is None or table.num_rows == 0:
            return []
        conn = self._pool.acquire()
        started = time.monotonic()
        try:
            conn.register(name, table)
            rows = conn.execute(f"SELECT {columns} FROM {name} WHERE date >= ? ORDER BY {order}",
                                [(datetime.now().date() - timedelta(days=days))]).fetchall()
            logger.info("analytics query=%s rows=%d duration_ms=%.1f", name, len(rows), (time.monotonic()-started)*1000)
            return rows
        except Exception:
            logger.exception("analytics query failed query=%s duration_ms=%.1f", name, (time.monotonic()-started)*1000)
            raise
        finally:
            self._pool.release(conn)

    def dashboard(self, days: int) -> DashboardData:
        return DashboardData(
            self._query("gold_daily_usage", "CAST(date AS DATE), CAST(dau AS INTEGER), CAST(total_api_calls AS INTEGER), CAST(timetable_searches AS INTEGER)", "date", days),
            self._query("gold_endpoint_health", "CAST(date AS DATE), CAST(endpoint AS VARCHAR), CAST(total_calls AS INTEGER), CAST(p95_latency_ms AS DOUBLE), CAST(error_rate AS DOUBLE)", "date, endpoint", days),
            self._query("gold_section_trends", "CAST(date AS DATE), CAST(section_name AS VARCHAR), CAST(section_year AS INTEGER), CAST(search_volume AS INTEGER)", "date, section_name", days),
            datetime.now(UTC),
        )


class MotherDuckAnalyticsReader(LocalAnalyticsReader):
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        if not self.settings.MOTHERDUCK_TOKEN:
            raise ValueError("MOTHERDUCK_TOKEN is required for MotherDuck analytics")
        database = self.settings.MOTHERDUCK_DATABASE
        target = f"md:{database}" if database else "md:"
        self._pool = _ConnectionPool(lambda: duckdb.connect(target, config={"motherduck_token": self.settings.MOTHERDUCK_TOKEN}), self.settings.ANALYTICS_POOL_SIZE)

    def _query(self, name: str, columns: str, order: str, days: int):
        """Run only the allow-listed dashboard projection on MotherDuck views."""
        conn = self._pool.acquire()
        started = time.monotonic()
        try:
            conn.execute("SET statement_timeout = ?", [self.settings.ANALYTICS_QUERY_TIMEOUT_SECONDS * 1000])
            rows = conn.execute(
                f"SELECT {columns} FROM {name} WHERE date >= ? ORDER BY {order}",
                [datetime.now().date() - timedelta(days=days)],
            ).fetchall()
            logger.info("analytics query=%s backend=motherduck rows=%d duration_ms=%.1f", name, len(rows), (time.monotonic() - started) * 1000)
            return rows
        except Exception:
            logger.exception("analytics query failed query=%s backend=motherduck duration_ms=%.1f", name, (time.monotonic() - started) * 1000)
            raise
        finally:
            self._pool.release(conn)


def get_analytics_reader(settings: Settings | None = None) -> AnalyticsReader:
    settings = settings or get_settings()
    if settings.ANALYTICS_QUERY_BACKEND == "motherduck":
        return MotherDuckAnalyticsReader(settings)
    if settings.ANALYTICS_QUERY_BACKEND != "local":
        raise ValueError("ANALYTICS_QUERY_BACKEND must be local or motherduck")
    return LocalAnalyticsReader(settings)
