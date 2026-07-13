"""Throwaway script to sanity-check the pipeline against a real Excel file.
Not part of the package. Edit the constants below and run directly.
Delete once the Telegram bot exists and does this job properly.
"""

import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.pipeline.orchestrate import process_upload_and_apply
from backend.pipeline.parser import parse_section_grid
from backend.pipeline.scope import UpsertScope

FILE_PATH = "./data/Timetable_7th.xlsx"  # <-- edit this
YEAR = 4  # <-- edit this (parse_section_grid needs a year per grid)
APPLY = True  # <-- flip to True once dry run output looks right


def main() -> None:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if database_url is None:
        raise RuntimeError("DATABASE_URL is not set (check your .env)")

    df = pd.read_excel(FILE_PATH, sheet_name="Section Grid")
    rows = parse_section_grid(df, YEAR)
    print(f"Parsed {len(rows)} rows from {FILE_PATH}")

    engine = create_engine(database_url)
    with Session(engine) as session:
        if not APPLY:
            print("DRY RUN — not committing. Set APPLY = True to actually write.")
            # just eyeball `rows` here, or add a quick print of section/day/period
            for r in rows[:10]:
                print(r)
        else:
            snapshot, result = process_upload_and_apply(
                session, rows, UpsertScope(), source_filename=FILE_PATH
            )
            print(f"Bronze snapshot id={snapshot.id} status={snapshot.status}")
            print(f"Deleted {result.deleted_count}, inserted {result.inserted_count}")


if __name__ == "__main__":
    main()
