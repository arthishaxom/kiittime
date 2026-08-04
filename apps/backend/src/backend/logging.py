import json
import logging
import os
import time
from logging.handlers import QueueHandler, QueueListener
from queue import Queue
from typing import Any

import axiom_py
import structlog
from axiom_py.logging import AxiomHandler

_queue_listener: QueueListener | None = None


class StructlogAxiomHandler(AxiomHandler):
    """Custom AxiomHandler that formats structlog log records for Axiom ingestion."""

    def emit(self, record: logging.LogRecord) -> None:
        if hasattr(record, "event_dict") and isinstance(record.event_dict, dict):
            event = record.event_dict
        elif isinstance(record.msg, dict):
            event = record.msg
        elif isinstance(record.msg, str):
            try:
                event = json.loads(record.msg)
            except Exception:
                event = {"event": record.msg}
        else:
            event = record.__dict__

        self.buffer.append(event)
        if len(self.buffer) >= 1000 or (
            time.monotonic() - self.last_flush > self.interval
        ):
            self.flush()


def setup_logging() -> None:
    global _queue_listener

    axiom_api_key = os.getenv("AXIOM_API_KEY")
    axiom_dataset = os.getenv("AXIOM_DATASET", "kiittime-backend-logs")

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=False,
    )

    if axiom_api_key:
        client = axiom_py.Client(axiom_api_key)
        axiom_handler = StructlogAxiomHandler(client=client, dataset=axiom_dataset)
        log_queue: Queue[Any] = Queue(-1)
        q_handler = QueueHandler(log_queue)

        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        root_logger.addHandler(q_handler)

        _queue_listener = QueueListener(log_queue, axiom_handler)
        _queue_listener.start()
