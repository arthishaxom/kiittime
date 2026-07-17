import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.api.routers import admin, announcements, auth, sections, timetable
from backend.db.session import get_db

load_dotenv()

app = FastAPI(title="KIIT Time API")

allowed_origins = os.environ["ALLOWED_ORIGINS"].split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(announcements.router)
app.include_router(auth.router)
app.include_router(sections.router)
app.include_router(timetable.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
