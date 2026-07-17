from sqlalchemy import select, update
from sqlalchemy.orm import Session

from backend.db.models import Announcement


def create_announcement(
    db: Session,
    *,
    title: str,
    body: str,
    link_label: str | None,
    link_url: str | None,
    created_by: str | None,
) -> Announcement:
    db.execute(update(Announcement).where(Announcement.is_active).values(is_active=False))

    announcement = Announcement(
        title=title,
        body=body,
        link_label=link_label,
        link_url=link_url,
        created_by=created_by,
        is_active=True,
    )
    db.add(announcement)
    db.flush()
    return announcement


def get_current_announcement(db: Session) -> Announcement | None:
    stmt = (
        select(Announcement)
        .where(Announcement.is_active)
        .order_by(Announcement.created_at.desc())
        .limit(1)
    )
    return db.execute(stmt).scalars().first()


def deactivate_current(db: Session) -> None:
    db.execute(update(Announcement).where(Announcement.is_active).values(is_active=False))
