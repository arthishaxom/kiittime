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
        else:
            msg_str = record.getMessage()
            try:
                event = json.loads(msg_str)
            except Exception:
                event = {"event": msg_str}

        self.buffer.append(event)
        if len(self.buffer) >= 1000 or (time.monotonic() - self.last_flush > self.interval):
            self.flush()


def setup_logging() -> None:
    global _queue_listener

    axiom_api_key = os.getenv("AXIOM_API_KEY")
    axiom_dataset = os.getenv("AXIOM_DATASET", "kiittime-backend-logs")

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=structlog.processors.JSONRenderer(),
    )

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(formatter)
    root_logger.addHandler(stdout_handler)

    if axiom_api_key:
        client = axiom_py.Client(axiom_api_key)
        axiom_handler = StructlogAxiomHandler(client=client, dataset=axiom_dataset)
        log_queue: Queue[Any] = Queue(-1)
        q_handler = QueueHandler(log_queue)
        q_handler.setFormatter(formatter)
        root_logger.addHandler(q_handler)

        _queue_listener = QueueListener(log_queue, axiom_handler)
        _queue_listener.start()
        print("✅ Axiom log ingestion initialized.", file=sys.stderr)
    else:
        print(
            "⚠️ [LOGGING WARNING] AXIOM_API_KEY is missing in environment. "
            "Axiom log ingestion is DISABLED.",
            file=sys.stderr,
        )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.ExtraAdder(),
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=False,
    )
