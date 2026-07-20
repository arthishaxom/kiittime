from datetime import time

from pydantic import BaseModel


class SessionRow(BaseModel):
    year: int
    section: str
    day: str
    period_number: int
    start_time: time
    course_code: str
    faculty_name: str | None
    room_number: str
