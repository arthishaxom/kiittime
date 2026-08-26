"""Backend-independent analytics compute seam.

Only predefined queries are exposed; callers never receive a database handle.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import duckdb
from deltalake import DeltaTable

from backend.config import Settings, get_duckdb_conn, get_settings

logger = logging.getLogger(__name__)
_reader_instances: dict[tuple[str, str, str, int], Any] = {}


@dataclass(frozen=True)
class DashboardData:
    usage: list[tuple[Any, ...]]
    endpoint_health: list[tuple[Any, ...]]
    section_trends: list[tuple[Any, ...]]
    data_as_of: datetime
    stale: bool = False


class AnalyticsReader(Protocol):
    def dashboard(self, days: int) -> DashboardData: ...


class _FallbackReader:
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
                logger.error("analytics unavailable days=%d error_type=%s", days, type(exc).__name__)
                raise
            logger.warning("analytics stale fallback days=%d error_type=%s", days, type(exc).__name__)
            return DashboardData(cached.usage, cached.endpoint_health, cached.section_trends,
                                 cached.data_as_of, stale=True)
        with self._lock:
            self._cache[days] = result
            while len(self._cache) > self._max_entries:
                del self._cache[next(iter(self._cache))]
        return result


class _ConnectionPool:
    def __init__(self, factory, size: int):
        self._factory = factory
        self._connections = queue.LifoQueue(maxsize=max(1, size))
        self._slots = threading.BoundedSemaphore(max(1, size))

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

    def release(self, conn):
        try:
            self._connections.put_nowait(conn)
        except queue.Full:
            conn.close()
        finally:
            self._slots.release()


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
        self._pool = _ConnectionPool(self._connect, self.settings.ANALYTICS_POOL_SIZE)

    def _connect(self):
        conn = duckdb.connect(
            f"md:{self.settings.MOTHERDUCK_DATABASE}" if self.settings.MOTHERDUCK_DATABASE else "md:",
            config={"motherduck_token": self.settings.MOTHERDUCK_TOKEN},
        )
        if self.settings.R2_ACCESS_KEY and self.settings.R2_SECRET_KEY and self.settings.CF_ACCOUNT_ID:
            conn.execute(
                "CREATE OR REPLACE SECRET r2 (TYPE R2, KEY_ID ?, SECRET ?, ACCOUNT_ID ?, SCOPE ('s3://', 'r2://'))",
                [self.settings.R2_ACCESS_KEY, self.settings.R2_SECRET_KEY, self.settings.CF_ACCOUNT_ID],
            )
        return conn

    def _query(self, name: str, columns: str, order: str, days: int):
        """Run only the allow-listed dashboard projection on MotherDuck views."""
        conn = self._pool.acquire()
        started = time.monotonic()
        attempts = 2
        try:
            for attempt in range(attempts):
                try:
                    conn.execute("SET statement_timeout = ?", [self.settings.ANALYTICS_QUERY_TIMEOUT_SECONDS * 1000])
                    base = self.settings.GOLD_BASE_PATH or f"s3://{self.settings.R2_BUCKET_NAME}/gold"
                    source = f"delta_scan('{base}/{name}')"
                    rows = conn.execute(
                        f"SELECT {columns} FROM {source} WHERE date >= ? ORDER BY {order}",
                        [datetime.now().date() - timedelta(days=days)],
                    ).fetchall()
                    logger.info("analytics query=%s backend=motherduck rows=%d duration_ms=%.1f", name, len(rows), (time.monotonic() - started) * 1000)
                    return rows
                except Exception as exc:
                    transient = any(term in str(exc).lower() for term in ("timeout", "timed out", "connection", "network"))
                    logger.exception("analytics query failed query=%s backend=motherduck attempt=%d transient=%s duration_ms=%.1f", name, attempt + 1, transient, (time.monotonic() - started) * 1000)
                    if not transient or attempt == attempts - 1:
                        raise
        finally:
            self._pool.release(conn)


def get_analytics_reader(settings: Settings | None = None) -> AnalyticsReader:
    settings = settings or get_settings()
    key = (settings.ANALYTICS_QUERY_BACKEND, settings.MOTHERDUCK_DATABASE,
           settings.GOLD_BASE_PATH or "", settings.ANALYTICS_POOL_SIZE)
    if key in _reader_instances:
        return _reader_instances[key]
    if settings.ANALYTICS_QUERY_BACKEND == "motherduck":
        reader = _FallbackReader(MotherDuckAnalyticsReader(settings))
    elif settings.ANALYTICS_QUERY_BACKEND == "local":
        reader = _FallbackReader(LocalAnalyticsReader(settings))
    else:
        raise ValueError("ANALYTICS_QUERY_BACKEND must be local or motherduck")
    _reader_instances[key] = reader
    return reader
