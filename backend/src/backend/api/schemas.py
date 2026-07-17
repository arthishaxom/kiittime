from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    section_name: str
    year: int

class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day: str
    period_number: int
    start_time: time
    course_code: str
    course_name: str | None
    faculty_name: str
    room_number: str
    section: str

    @model_validator(mode="before")
    @classmethod
    def flatten_from_class_session(cls, obj):
        return {
            "day": obj.day,
            "period_number": obj.period_number,
            "start_time": obj.start_time,
            "course_code": obj.course.course_code,
            "course_name": obj.course.course_name,
            "faculty_name": obj.faculty.faculty_name,
            "room_number": obj.room.room_number,
            "section": obj.section.section_name,
        }
    
class TimetableOut(BaseModel):
    sections_requested: list[str]
    sessions: list[SessionOut]


class TokenOut(BaseModel):
    access_token: str
    token_type: str


class SessionDetail(BaseModel):
    section: str
    day: str
    period_number: int
    course_code: str
    faculty_name: str
    room_number: str
    change_type: Literal["added", "changed", "removed", "unchanged"] | None = None
    previous: "SessionDetail | None" = None


class DiffSummary(BaseModel):
    session_count: int
    sections: list[str]
    session_details: list[SessionDetail]


class UploadResponse(BaseModel):
    upload_id: int
    diff: DiffSummary
    status: str


class ApproveResponse(BaseModel):
    status: str
    upload_id: int


class RejectResponse(BaseModel):
    status: str
    upload_id: int


class InspectResponse(BaseModel):
    sheet_names: list[str]


<<<<<<< HEAD
<<<<<<< HEAD
class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    link_label: str | None
    link_url: str | None
    created_at: datetime


class CreateAnnouncementRequest(BaseModel):
    title: str = Field(max_length=80)
    body: str = Field(max_length=500)
    link_label: str | None = Field(default=None, max_length=30)
    link_url: str | None = None


class ClearAnnouncementResponse(BaseModel):
    status: str


=======
>>>>>>> origin/dev
=======
>>>>>>> origin/main
class ClearAllResponse(BaseModel):
    status: str
    class_sessions_deleted: int
    sections_deleted: int
    courses_deleted: int
    faculty_deleted: int
    rooms_deleted: int
    bronze_snapshots_deleted: int
