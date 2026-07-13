from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.dao.timetable_dao import get_sessions_by_sections
from backend.api.schemas import TimetableOut
from backend.db.models import Section
from backend.db.session import get_db

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/", response_model=TimetableOut)
def get_timetable(
    section_id: Annotated[list[int], Query()],
    db: Session = Depends(get_db),
) -> Any:
    sessions = get_sessions_by_sections(db, section_id)
    sections = db.execute(
        select(Section).where(Section.id.in_(section_id))
    ).scalars().all()

    return {
        "sections_requested": [s.section_name for s in sections],
        "sessions": sessions,
    }
