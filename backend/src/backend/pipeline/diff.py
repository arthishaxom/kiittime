from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from backend.api.schemas import SessionDetail
from backend.db.models import ClassSession
from backend.pipeline.resolve import ResolvedSession
from backend.pipeline.schemas import SessionRow


def compute_diff(
    db: Session,
    rows: list[SessionRow],
    resolved: list[ResolvedSession],
) -> list[SessionDetail]:
    """
    Compare incoming parsed rows against existing gold data (class_sessions)
    and classify each row as added / changed / removed / unchanged.

    The comparison key is (section_id, day, period_number) which aligns with
    ClassSession's unique constraint.
    """
    section_ids = {r.section_id for r in resolved}

    print(f"[DEBUG] section_ids={section_ids}")

    # === Build incoming lookup: key -> SessionDetail ===
    incoming: dict[tuple[int, str, int], SessionDetail] = {}
    for r_row, r_resolved in zip(rows, resolved):
        key = (r_resolved.section_id, r_resolved.day, r_resolved.period_number)
        incoming[key] = SessionDetail(
            section=r_row.section,
            day=r_row.day,
            period_number=r_row.period_number,
            course_code=r_row.course_code,
            faculty_name=r_row.faculty_name,
            room_number=r_row.room_number,
        )

    if not section_ids:
        # No sections means nothing to compare against; everything is "added".
        for detail in incoming.values():
            detail.change_type = "added"
        return list(incoming.values())

    print(f"[DEBUG] incoming count for section 411: {sum(1 for k in incoming if k[0] == 411)}")
    for k in incoming:
        if k[0] == 411:
            print(f"[INCOMING] key={k!r} key_types={tuple(type(x) for x in k)}")

    # === Build existing lookup: key -> SessionDetail ===
    existing: dict[tuple[int, str, int], SessionDetail] = {}
    existing_sessions = (
        db.execute(
            select(ClassSession)
            .options(
                joinedload(ClassSession.course),
                joinedload(ClassSession.faculty),
                joinedload(ClassSession.room),
                joinedload(ClassSession.section),
            )
            .where(ClassSession.section_id.in_(section_ids))
        )
        .scalars()
        .unique()
        .all()
    )

    for cs in existing_sessions:
        key = (cs.section_id, cs.day, cs.period_number)
        existing[key] = SessionDetail(
            section=cs.section.section_name,
            day=cs.day,
            period_number=cs.period_number,
            course_code=cs.course.course_code,
            faculty_name=cs.faculty.faculty_name if cs.faculty is not None else None,
            room_number=cs.room.room_number,
        )

    print(f"[DEBUG] existing count for section 411: {sum(1 for k in existing if k[0] == 411)}")
    for k in existing:
        if k[0] == 411:
            print(f"[EXISTING] key={k!r} key_types={tuple(type(x) for x in k)}")

    # === Classify ===
    all_keys = incoming.keys() | existing.keys()
    result: list[SessionDetail] = []

    for key in sorted(all_keys):
        inc = incoming.get(key)
        exi = existing.get(key)

        if inc is not None and exi is None:
            inc.change_type = "added"
            result.append(inc)

        elif exi is not None and inc is None:
            exi.change_type = "removed"
            result.append(exi)

        elif inc is not None and exi is not None:
            if (
                inc.course_code != exi.course_code
                or inc.faculty_name != exi.faculty_name
                or inc.room_number != exi.room_number
            ):
                inc.change_type = "changed"
                inc.previous = exi
            else:
                inc.change_type = "unchanged"
            result.append(inc)

    return result
