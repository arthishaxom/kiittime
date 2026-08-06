"""Nightly ETL Prefect flow."""

from datetime import date

from prefect import flow

from analytics.tasks.axiom import pull_axiom_logs
from analytics.tasks.transform import (
    transform_bronze_to_silver,
    transform_silver_to_gold,
)


@flow(name="nightly-etl-flow")
def nightly_etl_flow(target_date: date | None = None) -> date:
    """Nightly analytics ETL flow: Bronze -> Silver -> Gold."""
    pulled_date = pull_axiom_logs(target_date=target_date)
    transform_bronze_to_silver(target_date=pulled_date)
    transform_silver_to_gold(target_date=pulled_date)
    return pulled_date


if __name__ == "__main__":
    nightly_etl_flow(target_date=date(2026, 8, 5))
