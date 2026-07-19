from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import Section


def get_all_sections(db: Session, year: int | None = None) -> list[Section]:
    stmt = select(Section)
    if year is not None:
        stmt = stmt.where(Section.year == year)
    return list(db.execute(stmt).scalars().all())
