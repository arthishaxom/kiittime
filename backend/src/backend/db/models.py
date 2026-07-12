from datetime import time

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_code: Mapped[str] = mapped_column(unique=True)
    course_name: Mapped[str]

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="course")


class Faculty(Base):
    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(primary_key=True)
    faculty_name: Mapped[str] = mapped_column(unique=True)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="faculty")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(unique=True)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="room")


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_name: Mapped[str]
    year: Mapped[int]

    __table_args__ = (UniqueConstraint("section_name", "year"),)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="section")


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)

    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id"))
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))

    day: Mapped[str]
    period_number: Mapped[int]
    start_time: Mapped[time]

    __table_args__ = (
        UniqueConstraint("section_id", "day", "period_number"),
    )

    section: Mapped["Section"] = relationship(back_populates="class_sessions")
    course: Mapped["Course"] = relationship(back_populates="class_sessions")
    faculty: Mapped["Faculty"] = relationship(back_populates="class_sessions")
    room: Mapped["Room"] = relationship(back_populates="class_sessions")
