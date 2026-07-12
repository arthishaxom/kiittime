from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, SnapshotStatus
from backend.pipeline.schemas import SessionRow  # adjust import to your actual SessionRow location


def write_bronze_snapshot(
    db: Session,
    rows: list[SessionRow],
    *,
    source_filename: str,
    uploaded_by: str | None = None,
    storage_path: str | None = None,
) -> BronzeSnapshot:
    """
    Persist a raw parsed upload as an immutable bronze record.

    Does NOT touch silver/gold tables — this is audit-trail only.
    Caller is responsible for committing (or rolling back) the transaction.
    """
    scope_section_ids = sorted({row.section for row in rows})

    snapshot = BronzeSnapshot(
        uploaded_by=uploaded_by,
        source_filename=source_filename,
        storage_path=storage_path,
        scope_section_ids=scope_section_ids,
        parsed_data=[row.model_dump(mode="json") for row in rows],
        status=SnapshotStatus.pending,
    )

    db.add(snapshot)
    db.flush()

    return snapshot