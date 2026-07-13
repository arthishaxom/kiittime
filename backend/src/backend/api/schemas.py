from datetime import time

from pydantic import BaseModel, ConfigDict, model_validator


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