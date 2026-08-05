"""Nightly ETL Prefect flow placeholder."""

from prefect import flow


@flow(name="nightly-etl-flow")
def nightly_etl_flow() -> None:
    """Placeholder for nightly analytics ETL flow."""
    pass


if __name__ == "__main__":
    nightly_etl_flow()
