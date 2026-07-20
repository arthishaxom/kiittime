from datetime import time

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.db.models import Course, Faculty, Room, Section
from backend.pipeline.schemas import SessionRow


class ResolvedSession(BaseModel):
    section_id: int
    course_id: int
    faculty_id: int | None
    room_id: int
    day: str
    period_number: int
    start_time: time


def resolve_all(db: Session, rows: list[SessionRow]) -> list[ResolvedSession]:
    """
    Batch-resolve every SessionRow's natural-key references (course, faculty,
    room, section) to DB ids, creating any entities that don't exist yet.

    Runs a fixed ~8 queries total, regardless of row count (no N+1).
    Caller is responsible for committing (or rolling back) the transaction.
    """

    course_codes = {r.course_code for r in rows}
    faculty_names = {r.faculty_name for r in rows if r.faculty_name is not None}
    room_numbers = {r.room_number for r in rows}
    section_keys = {(r.section, r.year) for r in rows}

    existing_courses = {
        c.course_code: c
        for c in db.execute(select(Course).where(Course.course_code.in_(course_codes))).scalars()
    }
    missing_course_codes = course_codes - existing_courses.keys()
    if missing_course_codes:
        new_courses = [Course(course_code=code, course_name=None) for code in missing_course_codes]
        db.add_all(new_courses)
        db.flush()
        existing_courses.update({c.course_code: c for c in new_courses})

    existing_faculty = {
        f.faculty_name: f
        for f in db.execute(
            select(Faculty).where(Faculty.faculty_name.in_(faculty_names))
        ).scalars()
    }
    missing_faculty_names = faculty_names - existing_faculty.keys()
    if missing_faculty_names:
        new_faculty = [Faculty(faculty_name=name) for name in missing_faculty_names]
        db.add_all(new_faculty)
        db.flush()
        existing_faculty.update({f.faculty_name: f for f in new_faculty})

    existing_rooms = {
        r.room_number: r
        for r in db.execute(select(Room).where(Room.room_number.in_(room_numbers))).scalars()
    }
    missing_room_numbers = room_numbers - existing_rooms.keys()
    if missing_room_numbers:
        new_rooms = [Room(room_number=num) for num in missing_room_numbers]
        db.add_all(new_rooms)
        db.flush()
        existing_rooms.update({r.room_number: r for r in new_rooms})

    existing_sections_list = db.execute(
        select(Section).where(Section.year.in_({y for (_, y) in section_keys}))
    ).scalars()
    existing_sections = {
        (s.section_name, s.year): s
        for s in existing_sections_list
        if (s.section_name, s.year) in section_keys
    }
    missing_section_keys = section_keys - existing_sections.keys()
    if missing_section_keys:
        new_sections = [
            Section(section_name=name, year=year) for name, year in missing_section_keys
        ]
        db.add_all(new_sections)
        db.flush()
        existing_sections.update({(s.section_name, s.year): s for s in new_sections})

    return [
        ResolvedSession(
            section_id=existing_sections[(r.section, r.year)].id,
            course_id=existing_courses[r.course_code].id,
            faculty_id=existing_faculty[r.faculty_name].id if r.faculty_name is not None else None,
            room_id=existing_rooms[r.room_number].id,
            day=r.day,
            period_number=r.period_number,
            start_time=r.start_time,
        )
        for r in rows
    ]
