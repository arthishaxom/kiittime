from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.api.dao.announcement_dao import get_current_announcement
from backend.api.schemas import AnnouncementOut
from backend.db.session import get_db

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("/current", response_model=AnnouncementOut | None)
def get_current(db: Session = Depends(get_db)) -> Any:
    return get_current_announcement(db)
