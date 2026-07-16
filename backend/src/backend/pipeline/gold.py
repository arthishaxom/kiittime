from pydantic import BaseModel
from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from backend.db.models import ClassSession, Section
from backend.pipeline.resolve import ResolvedSession
from backend.pipeline.scope import UpsertScope


class ScopeViolationError(Exception):
    """Raised when a resolved session falls outside the requested upsert scope.

    Raised BEFORE any database mutation so gold_upsert never partially applies.
    """


class UpsertResult(BaseModel):
    deleted_count: int
    inserted_count: int
    scope: UpsertScope


def gold_upsert(
    session: Session,
    resolved_sessions: list[ResolvedSession],
    scope: UpsertScope,
) -> UpsertResult:
    """
    Replace (delete + insert) the gold class_sessions for the given scope.

    Order of operations (never reorder):
    1. Safety check: every resolved row MUST fall within `scope`. Raise
       ScopeViolationError immediately if any row is out of scope — before the
       DELETE/INSERT runs, so we never apply a partial upsert.
    2. DELETE class_sessions for the sections implied by scope (or all rows for
       a full-semester scope).
    3. Bulk INSERT the resolved rows as gold class_sessions.

    No commit happens here — the caller owns the transaction (same convention
    as write_bronze_snapshot). DB-layer exceptions are NOT caught; they
    propagate so the caller's rollback handles them.
    """

    # 1. Pre-flight scope check (look up year only if year scoping).
    section_years: dict[int, int] = {}
    if scope.year is not None:
        ids = {r.section_id for r in resolved_sessions}
        for s in session.execute(select(Section).where(Section.id.in_(ids))).scalars():
            section_years[s.id] = s.year

    for r in resolved_sessions:
        year = section_years.get(r.section_id)
        if not scope.matches(r.section_id, year):
            raise ScopeViolationError(
                f"Row for section_id={r.section_id} is outside upsert scope (scope={scope!r})"
            )

    # 2. Determine which sections the DELETE targets.
    if scope.section_ids is not None:
        target_ids: set[int] | None = set(scope.section_ids)
    elif scope.year is not None:
        # All sections (across the upload) whose year matches the scope.
        target_ids = {
            s.id
            for s in session.execute(select(Section).where(Section.year == scope.year)).scalars()
        }
    else:
        target_ids = None  # full semester: delete every class_sessions row.

    delete_stmt = delete(ClassSession)
    if target_ids is not None:
        if not target_ids:
            deleted_count = 0
        else:
            delete_stmt = delete_stmt.where(ClassSession.section_id.in_(target_ids))
            deleted_count = session.execute(delete_stmt).rowcount
    else:
        deleted_count = session.execute(delete_stmt).rowcount

    # 3. Bulk insert via Core insert() with a list of dicts. For ~230 rows this
    # is more efficient than ORM add_all(): it bypasses the identity map and
    # per-object bookkeeping and emits a single multi-row INSERT.
    rows = [
        dict(
            section_id=r.section_id,
            course_id=r.course_id,
            faculty_id=r.faculty_id,
            room_id=r.room_id,
            day=r.day,
            period_number=r.period_number,
            start_time=r.start_time,
        )
        for r in resolved_sessions
    ]
    if rows:
        session.execute(insert(ClassSession), rows)
    inserted_count = len(rows)

    session.flush()
    return UpsertResult(
        deleted_count=deleted_count,
        inserted_count=inserted_count,
        scope=scope,
    )
