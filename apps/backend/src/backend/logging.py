import json
import logging
import os
import sys
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

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Check if a stdout StreamHandler already exists
    has_stdout = any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, QueueHandler)
        for h in root_logger.handlers
    )
    if not has_stdout:
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setFormatter(logging.Formatter("%(message)s"))
        root_logger.addHandler(stdout_handler)

    if axiom_api_key:
        client = axiom_py.Client(axiom_api_key)
        axiom_handler = StructlogAxiomHandler(client=client, dataset=axiom_dataset)
        log_queue: Queue[Any] = Queue(-1)
        q_handler = QueueHandler(log_queue)
        root_logger.addHandler(q_handler)

        _queue_listener = QueueListener(log_queue, axiom_handler)
        _queue_listener.start()

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]

    structlog.configure(
        processors=processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=False,
    )
