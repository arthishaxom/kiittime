from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, SnapshotStatus
from backend.pipeline.bronze import write_bronze_snapshot
from backend.pipeline.gold import ScopeViolationError, UpsertResult, gold_upsert
from backend.pipeline.resolve import ResolvedSession, resolve_all
from backend.pipeline.schemas import SessionRow
from backend.pipeline.scope import UpsertScope
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


def process_upload_and_apply(
    db: Session,
    rows: list[SessionRow],
    scope: UpsertScope,
    *,
    source_filename: str,
    uploaded_by: str | None = None,
    storage_path: str | None = None,
) -> tuple[BronzeSnapshot, UpsertResult]:
    """
    Phase 4 entry point: bronze write -> resolve -> validate -> gold upsert,
    all inside ONE transaction.

    Why a separate function instead of extending process_upload(): process_upload
    is the Phase 3 "audit + resolve + validate" primitive and deliberately does
    NOT touch gold or commit — the caller owns the transaction. This apply
    variant layers the gold write + commit on top, keeping each function
    single-purpose.

    Success: gold upsert is applied, the bronze snapshot is marked `approved`,
    and the whole transaction is COMMITTED (bronze + delete + insert land
    together).

    Failure (validation / scope violation / gold DB error): the bronze snapshot
    is marked `rejected` and the error is re-raised. The transaction is left
    UNCOMMITTED so the caller's rollback (or the test fixture) undoes everything
    including the bronze insert attempt — matching the existing Phase 3 failure
    semantics where the bronze row is preserved as `rejected` but not yet
    durable until the caller decides.
    """
    # process_upload raises ValidationError on bad data, already marking the
    # snapshot rejected; scope violations / gold errors happen below instead.
    snapshot, resolved = process_upload(
        db,
        rows,
        source_filename=source_filename,
        uploaded_by=uploaded_by,
        storage_path=storage_path,
    )

    try:
        result = gold_upsert(db, resolved, scope)
    except ScopeViolationError:
        snapshot.status = SnapshotStatus.rejected
        db.flush()
        raise
    except Exception:
        snapshot.status = SnapshotStatus.rejected
        db.flush()
        raise

    snapshot.status = SnapshotStatus.approved
    db.flush()
    db.commit()
    return snapshot, result
