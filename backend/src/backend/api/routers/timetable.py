from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.dao.timetable_dao import get_sessions_by_section
from backend.api.schemas import TimetableOut
from backend.db.models import Section
from backend.db.session import get_db

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/", response_model=TimetableOut)
def get_timetable(
    section_id: int = Query(...),
    db: Session = Depends(get_db),
) -> Any:
    sessions = get_sessions_by_section(db, section_id)
    section = db.get(Section, section_id)
    return {
        "sections_requested": [section.section_name] if section else [],
        "sessions": sessions,
    }