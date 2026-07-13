from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.api.dao.section_dao import get_all_sections
from backend.api.schemas import SectionOut
from backend.db.session import get_db

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("/", response_model=list[SectionOut])
def list_sections(
    year: int | None = Query(default=None, ge=1, le=4),
    db: Session = Depends(get_db),
) -> Any:
    sections = get_all_sections(db, year=year)
    return sections