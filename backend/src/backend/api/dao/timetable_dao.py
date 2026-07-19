from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.db.models import ClassSession


def get_sessions_by_sections(db: Session, section_ids: list[int]) -> list[ClassSession]:
    stmt = (
        select(ClassSession)
        .where(ClassSession.section_id.in_(section_ids))
        .options(
            joinedload(ClassSession.course),
            joinedload(ClassSession.faculty),
            joinedload(ClassSession.room),
            joinedload(ClassSession.section),
        )
    )
    return list(db.execute(stmt).scalars().all())
