from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.db.models import BronzeSnapshot, ClassSession, Course, Faculty, Room, Section


class ClearAllResult(BaseModel):
    class_sessions_deleted: int
    sections_deleted: int
    courses_deleted: int
    faculty_deleted: int
    rooms_deleted: int
    bronze_snapshots_deleted: int


def clear_all(session: Session) -> ClearAllResult:
    """Irreversibly wipe every gold and bronze table.

    No insert step — this is a hard reset for the start of a new semester
    (admin_users is untouched; login credentials aren't semester data).
    class_sessions is deleted first since it foreign-keys into
    sections/courses/faculty/rooms.

    No commit happens here — the caller owns the transaction (same
    convention as gold_upsert).
    """
    class_sessions_deleted = session.execute(delete(ClassSession)).rowcount
    sections_deleted = session.execute(delete(Section)).rowcount
    courses_deleted = session.execute(delete(Course)).rowcount
    faculty_deleted = session.execute(delete(Faculty)).rowcount
    rooms_deleted = session.execute(delete(Room)).rowcount
    bronze_snapshots_deleted = session.execute(delete(BronzeSnapshot)).rowcount

    session.flush()
    return ClearAllResult(
        class_sessions_deleted=class_sessions_deleted,
        sections_deleted=sections_deleted,
        courses_deleted=courses_deleted,
        faculty_deleted=faculty_deleted,
        rooms_deleted=rooms_deleted,
        bronze_snapshots_deleted=bronze_snapshots_deleted,
    )
