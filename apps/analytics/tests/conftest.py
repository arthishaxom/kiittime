"""Pytest fixtures and configuration for analytics tests."""

import os

# Suppress Prefect background server logs during unit tests
os.environ["PREFECT_LOGGING_TO_API_WHEN_MISSING_FLOW"] = "ignore"
os.environ["PREFECT_SERVER_LOGGING_LEVEL"] = "ERROR"
os.environ["PREFECT_LOGGING_SERVER_LEVEL"] = "ERROR"
