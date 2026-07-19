from datetime import datetime, time
from enum import Enum as PyEnum

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)
    course_code: Mapped[str] = mapped_column(unique=True)
    course_name: Mapped[str | None] = mapped_column(nullable=True)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="course")


class Faculty(Base):
    __tablename__ = "faculty"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)
    faculty_name: Mapped[str] = mapped_column(unique=True)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="faculty")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(unique=True)

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="room")


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_name: Mapped[str]
    year: Mapped[int]

    __table_args__ = (
        UniqueConstraint("section_name", "year"),
        {"schema": "kiittime"},
    )

    class_sessions: Mapped[list["ClassSession"]] = relationship(back_populates="section")


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)

    section_id: Mapped[int] = mapped_column(ForeignKey("kiittime.sections.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("kiittime.courses.id"))
    faculty_id: Mapped[int] = mapped_column(ForeignKey("kiittime.faculty.id"))
    room_id: Mapped[int] = mapped_column(ForeignKey("kiittime.rooms.id"))

    day: Mapped[str]
    period_number: Mapped[int]
    start_time: Mapped[time]

    __table_args__ = (
        UniqueConstraint("section_id", "day", "period_number"),
        {"schema": "kiittime"},
    )

    section: Mapped["Section"] = relationship(back_populates="class_sessions")
    course: Mapped["Course"] = relationship(back_populates="class_sessions")
    faculty: Mapped["Faculty"] = relationship(back_populates="class_sessions")
    room: Mapped["Room"] = relationship(back_populates="class_sessions")


class SnapshotStatus(PyEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class BronzeSnapshot(Base):
    __tablename__ = "bronze_snapshots"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)

    uploaded_by: Mapped[str | None] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    source_filename: Mapped[str] = mapped_column(String, nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String, nullable=True)

    scope_section_ids: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    parsed_data: Mapped[list[dict]] = mapped_column(JSONB, nullable=False)

    status: Mapped[SnapshotStatus] = mapped_column(
        Enum(SnapshotStatus, name="snapshot_status", schema="kiittime"),
        default=SnapshotStatus.pending,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<BronzeSnapshot id={self.id} file={self.source_filename} status={self.status}>"


class Announcement(Base):
    __tablename__ = "announcements"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    link_label: Mapped[str | None] = mapped_column(String, nullable=True)
    link_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[str | None] = mapped_column(String, nullable=True)

    def __repr__(self) -> str:
        return f"<Announcement id={self.id} title={self.title!r} is_active={self.is_active}>"


class AdminUser(Base):
    __tablename__ = "admin_users"
    __table_args__ = {"schema": "kiittime"}

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RollNumberMapping(Base):
    __tablename__ = "roll_number_mappings"

    id: Mapped[int] = mapped_column(primary_key=True)
    roll_no: Mapped[str] = mapped_column(String, index=True, nullable=False)
    section_id: Mapped[int] = mapped_column(ForeignKey("kiittime.sections.id"), nullable=False)
    academic_year: Mapped[int] = mapped_column(nullable=False)

    __table_args__ = (
        UniqueConstraint("roll_no", "section_id"),
        {"schema": "kiittime"},
    )

    section: Mapped["Section"] = relationship()


