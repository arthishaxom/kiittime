from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, SnapshotStatus
from backend.pipeline.bronze import write_bronze_snapshot
from backend.pipeline.resolve import ResolvedSession, resolve_all
from backend.pipeline.schemas import SessionRow
from backend.pipeline.validate import ValidationError, validate_resolved_sessions


def process_upload(
    db: Session,
    rows: list[SessionRow],
    *,
    source_filename: str,
    uploaded_by: str | None = None,
    storage_path: str | None = None,
) -> tuple[BronzeSnapshot, list[ResolvedSession]]:
    """
    Full Phase 3 pipeline entry point: bronze write -> resolve -> validate.

    Design decision: bronze is ALWAYS written and kept, even if validation
    fails downstream. Bronze is an audit trail of "what we received" — a bad
    upload is still something that was received, and erasing that evidence
    on failure would defeat the purpose of having an audit trail at all.
    If validation fails, the bronze row's status is set to `rejected` so the
    failure is visible in the record, and ValidationError is re-raised so
    the caller (eventually: the Telegram bot) knows to stop and report it.
    No gold writes happen in this function — that's Phase 4, deliberately
    separate.

    Caller is responsible for the final commit (or rollback) of the
    transaction after this returns successfully.
    """
    snapshot = write_bronze_snapshot(
        db,
        rows,
        source_filename=source_filename,
        uploaded_by=uploaded_by,
        storage_path=storage_path,
    )

    resolved = resolve_all(db, rows)

    try:
        validate_resolved_sessions(resolved)
    except ValidationError:
        snapshot.status = SnapshotStatus.rejected
        db.flush()
        raise

    return snapshot, resolved
