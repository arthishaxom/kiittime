from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.db.models import ClassSession


def get_sessions_by_section(db: Session, section_id: int) -> list[ClassSession]:
    stmt = (
        select(ClassSession)
        .where(ClassSession.section_id == section_id)
        .options(
            joinedload(ClassSession.course),
            joinedload(ClassSession.faculty),
            joinedload(ClassSession.room),
            joinedload(ClassSession.section),
        )
    )
    return list(db.execute(stmt).scalars().all())