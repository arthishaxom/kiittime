from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas import RollNumberMappingOut
from backend.db.models import RollNumberMapping, Section
from backend.db.session import get_db

router = APIRouter(prefix="/api/roll-numbers", tags=["roll-numbers"])


@router.get("/{roll_no}", response_model=RollNumberMappingOut)
def lookup_roll_number(
    roll_no: str,
    db: Session = Depends(get_db),
) -> Any:
    # 1. Check if there are any sections in the DB (global empty state check)
    has_any_section = db.execute(select(Section).limit(1)).scalar_one_or_none()
    if not has_any_section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No timetables uploaded yet",
        )

    # 2. Query roll number mappings
    mappings = (
        db.execute(select(RollNumberMapping).where(RollNumberMapping.roll_no == roll_no))
        .scalars()
        .all()
    )

    if not mappings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Roll number not found",
        )

    # All mappings for a student should have the same academic year
    academic_year = mappings[0].academic_year
    sections = [m.section for m in mappings if m.section is not None]

    return {
        "roll_no": roll_no,
        "academic_year": academic_year,
        "sections": sections,
    }
