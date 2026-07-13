"""One-off bootstrap loader for the 7th-semester timetable into Aiven.

Throws a parse -> process_upload_and_apply run end-to-end. Not part of the
package, kept out of git. Run directly once reviewed:

    uv run python scratch/load_timetable_7th.py

This is an APPLY-on-run script (no dry-run flag) — it WILL commit to the
database pointed at by DATABASE_URL. The DB portion rolls back on any
exception so a partial failure never lands silently.
"""

import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.pipeline.orchestrate import process_upload_and_apply
from backend.pipeline.parser import parse_section_grid
from backend.pipeline.scope import UpsertScope

FILE_PATH = "./data/Timetable_7th.xlsx"  # relative to backend/ (cwd when run)
SHEET_NAME = "Section Grid"
YEAR = 4 # this file is the 7th-semester timetable


def main() -> None:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL is not set (check your .env)")

    df = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME)
    sessions = parse_section_grid(df, YEAR)

    if len(sessions) == 0:
        raise RuntimeError(
            f"Parsed 0 sessions from {FILE_PATH} — refusing to proceed with an empty upsert."
        )

    # Sanity check before touching the DB (mirrors scratch_explore.ipynb).
    print(f"Parsed {len(sessions)} sessions — first row:")
    print(sessions[0])

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)

    db = SessionLocal()
    try:
        snapshot, result = process_upload_and_apply(
            db,
            sessions,
            UpsertScope(),  # full replace scope: section_ids=None & department=None => everything in scope
            source_filename="Timetable_7th.xlsx",
            uploaded_by="manual-aiven-bootstrap",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    print(
        f"UpsertResult: deleted_count={result.deleted_count}, "
        f"inserted_count={result.inserted_count}, scope={result.scope}"
    )
    print(f"Bronze snapshot committed — id={snapshot.id}, status={snapshot.status}")


if __name__ == "__main__":
    main()
