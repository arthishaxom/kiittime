"""PostHog export handling tasks."""

from datetime import date

from prefect import task


@task
def check_posthog_files(target_date: date, path: str) -> bool:
    """Return whether PostHog has delivered at least one file for the date."""
    from pathlib import Path

    if path.startswith(("s3://", "r2://")):
        return True
    return any(Path(path).parent.glob(Path(path).name))
