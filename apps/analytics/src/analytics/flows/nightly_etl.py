"""Nightly ETL Prefect flow."""

import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

# Ensure 'src' is on sys.path for remote runners
src_path = str(Path(__file__).resolve().parents[2])
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from prefect import flow

from analytics.tasks.axiom import pull_axiom_logs
from analytics.tasks.transform import (
    transform_bronze_to_silver,
    transform_silver_to_gold,
)

IST_TIMEZONE = ZoneInfo("Asia/Kolkata")


@flow(name="nightly-etl-flow")
def nightly_etl_flow(target_date: date | None = None) -> date:
    """Nightly analytics ETL flow: Bronze -> Silver -> Gold."""
    if target_date is None:
        now_ist = datetime.now(IST_TIMEZONE)
        target_date = (now_ist - timedelta(days=1)).date()

    pulled_date = pull_axiom_logs(target_date=target_date)
    transform_bronze_to_silver(target_date=pulled_date)
    transform_silver_to_gold(target_date=pulled_date)
    return pulled_date


if __name__ == "__main__":
    nightly_etl_flow()

