from io import BytesIO
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.api.dao.announcement_dao import create_announcement, deactivate_current
from backend.api.schemas import (
    AnnouncementOut,
    ApproveResponse,
    ClearAllResponse,
    ClearAnnouncementResponse,
    ClearRollMappingsResponse,
    CreateAnnouncementRequest,
    DiffSummary,
    InspectResponse,
    RejectResponse,
    RollMappingInspectResponse,
    RollNumberUploadResponse,
    UploadResponse,
)
from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser, BronzeSnapshot, RollNumberMapping, Section, SnapshotStatus
from backend.db.session import get_db
from backend.pipeline.clear import clear_all
from backend.pipeline.diff import compute_diff
from backend.pipeline.gold import ScopeViolationError, gold_upsert
from backend.pipeline.orchestrate import process_upload
from backend.pipeline.parser import parse_section_grid
from backend.pipeline.resolve import ResolvedSession, resolve_all
from backend.pipeline.schemas import SessionRow
from backend.pipeline.scope import UpsertScope
from backend.pipeline.validate import ValidationError

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/uploads/inspect", response_model=InspectResponse)
def inspect_upload(
    file: UploadFile,
    current_admin: AdminUser = Depends(get_current_admin),
) -> dict:
    contents = file.file.read()
    try:
        xl = pd.ExcelFile(BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Failed to read Excel file: {e}",
        )
    return {"sheet_names": xl.sheet_names}


def _build_diff_summary(
    db: Session,
    rows: list[SessionRow],
    resolved: list[ResolvedSession],
) -> DiffSummary:
    sections = sorted({r.section for r in rows})
    session_details = compute_diff(db, rows, resolved)
    # Full list returned (~230 rows max per upload). Paginate later if
    # uploads grow significantly beyond this size.
    return DiffSummary(
        session_count=len(resolved),
        sections=sections,
        session_details=session_details,
    )


@router.post("/uploads", response_model=UploadResponse, status_code=status.HTTP_200_OK)
def create_upload(
    file: UploadFile,
    sheet_name: str = Form(...),
    year: int = Form(...),
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    contents = file.file.read()
    try:
        xl = pd.ExcelFile(BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Failed to read Excel file: {e}",
        )

    if sheet_name not in xl.sheet_names:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Sheet {sheet_name!r} not found. Available sheets: {xl.sheet_names}",
        )

    df = xl.parse(sheet_name=sheet_name)

    try:
        rows = parse_section_grid(df, year=year)
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Failed to parse file: {e}",
        )

    try:
        snapshot, resolved = process_upload(
            db,
            rows,
            source_filename=file.filename or "unknown",
            uploaded_by=current_admin.username,
        )
    except ValidationError as e:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e))

    db.commit()

    diff = _build_diff_summary(db, rows, resolved)
    return {"upload_id": snapshot.id, "diff": diff, "status": "pending"}


@router.get("/uploads/{upload_id}", response_model=UploadResponse)
def get_upload(
    upload_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    snapshot = db.get(BronzeSnapshot, upload_id)
    if snapshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Upload not found")

    rows = [SessionRow(**d) for d in snapshot.parsed_data]
    resolved = resolve_all(db, rows)
    diff = _build_diff_summary(db, rows, resolved)

    return {"upload_id": snapshot.id, "diff": diff, "status": snapshot.status.value}


@router.post("/uploads/{upload_id}/approve", response_model=ApproveResponse)
def approve_upload(
    upload_id: int,
    scope: UpsertScope,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    snapshot = db.get(BronzeSnapshot, upload_id)
    if snapshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if snapshot.status != SnapshotStatus.pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Upload is already {snapshot.status.value}",
        )

    rows = [SessionRow(**d) for d in snapshot.parsed_data]
    resolved = resolve_all(db, rows)

    try:
        gold_upsert(db, resolved, scope)
    except ScopeViolationError as e:
        db.rollback()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    snapshot.status = SnapshotStatus.approved
    db.commit()

    return {"status": "approved", "upload_id": upload_id}


@router.post("/uploads/{upload_id}/reject", response_model=RejectResponse)
def reject_upload(
    upload_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    snapshot = db.get(BronzeSnapshot, upload_id)
    if snapshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Upload not found")
    if snapshot.status != SnapshotStatus.pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Upload is already {snapshot.status.value}",
        )

    snapshot.status = SnapshotStatus.rejected
    db.commit()

    return {"status": "rejected", "upload_id": upload_id}


@router.post("/announcements", response_model=AnnouncementOut)
def create_announcement_route(
    payload: CreateAnnouncementRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> Any:
    announcement = create_announcement(
        db,
        title=payload.title,
        body=payload.body,
        link_label=payload.link_label,
        link_url=payload.link_url,
        created_by=current_admin.username,
    )
    db.commit()
    db.refresh(announcement)
    return announcement


@router.post("/announcements/clear", response_model=ClearAnnouncementResponse)
def clear_announcement_route(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    deactivate_current(db)
    db.commit()
    return {"status": "cleared"}


@router.post("/clear-all", response_model=ClearAllResponse)
def clear_all_route(
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Irreversibly wipe every gold and bronze table. No upload attached."""
    result = clear_all(db)
    db.commit()

    return {"status": "cleared", **result.model_dump()}


@router.post("/roll-mappings/inspect", response_model=RollMappingInspectResponse)
def inspect_roll_mappings(
    file: UploadFile,
    sheet_name: str | None = Form(None),
    current_admin: AdminUser = Depends(get_current_admin),
) -> dict:
    contents = file.file.read()
    try:
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(BytesIO(contents), nrows=0)
            return {"columns": [str(c).strip() for c in df.columns]}
        else:
            xls = pd.ExcelFile(BytesIO(contents))
            if sheet_name:
                if sheet_name not in xls.sheet_names:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Sheet '{sheet_name}' not found in Excel file.",
                    )
                df = pd.read_excel(xls, sheet_name=sheet_name, nrows=0)
                return {"columns": [str(c).strip() for c in df.columns]}
            
            if len(xls.sheet_names) > 1:
                return {"sheet_names": xls.sheet_names}
            
            df = pd.read_excel(xls, sheet_name=xls.sheet_names[0], nrows=0)
            return {"columns": [str(c).strip() for c in df.columns]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Failed to read file: {e}",
        )



@router.post("/roll-mappings/upload", response_model=RollNumberUploadResponse)
def upload_roll_mappings(
    file: UploadFile,
    academic_year: int = Form(...),
    roll_col_name: str | None = Form(None),
    sec_col_name: str | None = Form(None),
    sheet_name: str | None = Form(None),
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    import re

    contents = file.file.read()
    try:
        if file.filename and file.filename.endswith(".csv"):
            df = pd.read_csv(BytesIO(contents))
        else:
            if sheet_name:
                df = pd.read_excel(BytesIO(contents), sheet_name=sheet_name)
            else:
                df = pd.read_excel(BytesIO(contents))
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Failed to read file: {e}",
        )

    cols = [str(c).strip().lower() for c in df.columns]

    roll_col_idx = -1
    if roll_col_name:
        roll_col_target = roll_col_name.strip().lower()
        try:
            roll_col_idx = cols.index(roll_col_target)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Specified roll number column '{roll_col_name}' not found in file.",
            )
    else:
        for i, c in enumerate(cols):
            if "roll" in c or c == "rn" or c == "id":
                roll_col_idx = i
                break

    sec_col_idx = -1
    if sec_col_name:
        sec_col_target = sec_col_name.strip().lower()
        try:
            sec_col_idx = cols.index(sec_col_target)
        except ValueError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Specified section column '{sec_col_name}' not found in file.",
            )
    else:
        for i, c in enumerate(cols):
            if "section" in c or c == "sec" or c == "class":
                sec_col_idx = i
                break

    if roll_col_idx == -1:
        roll_col_idx = 0
    if sec_col_idx == -1:
        sec_col_idx = 1 if len(cols) > 1 else -1

    if sec_col_idx == -1 or roll_col_idx == sec_col_idx:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Could not identify roll number and section columns in the file.",
        )

    def normalize_section_name(name: str) -> str:
        n = name.strip().lower()
        n = re.sub(r"[-_\s]+", "", n)
        if n.startswith("cse"):
            n = "cs" + n[3:]
        if n.isdigit():
            n = "cs" + n
        return n

    sections = db.execute(select(Section).where(Section.year == academic_year)).scalars().all()
    section_map = {normalize_section_name(s.section_name): s for s in sections}

    mappings_to_create = []
    seen_pairs = set()

    for idx, row in df.iterrows():
        raw_roll = row.iloc[roll_col_idx]
        if pd.isna(raw_roll):
            continue

        if isinstance(raw_roll, float):
            if raw_roll.is_integer():
                roll_val = str(int(raw_roll))
            else:
                roll_val = str(raw_roll)
        elif isinstance(raw_roll, int):
            roll_val = str(raw_roll)
        else:
            roll_val = str(raw_roll).strip()
            if roll_val.endswith(".0"):
                roll_val = roll_val[:-2]

        if not roll_val:
            continue

        raw_sec = row.iloc[sec_col_idx]
        if pd.isna(raw_sec):
            continue
        sec_val = str(raw_sec).strip()
        if not sec_val:
            continue

        raw_sections = [s.strip() for s in re.split(r"[,;]+", sec_val) if s.strip()]
        for sec_name in raw_sections:
            norm_name = normalize_section_name(sec_name)
            if norm_name not in section_map:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=(
                        f"Section '{sec_name}' not found for academic year {academic_year}. "
                        "Please upload the timetable for this section first."
                    ),
                )
            sec_obj = section_map[norm_name]
            pair = (roll_val, sec_obj.id)
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                mappings_to_create.append((roll_val, sec_obj.id))

    from sqlalchemy.dialects.postgresql import insert as pg_insert

    inserted_count = 0
    if mappings_to_create:
        stmt = pg_insert(RollNumberMapping).values([
            {"roll_no": r, "section_id": s_id, "academic_year": academic_year}
            for r, s_id in mappings_to_create
        ])
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["roll_no", "section_id", "academic_year"]
        ).returning(RollNumberMapping.id)
        result = db.execute(stmt)
        inserted_count = len(result.all())
        db.commit()

    return {
        "status": "success",
        "created_count": inserted_count,
        "deleted_count": 0,
    }


@router.delete("/roll-mappings/{academic_year}", response_model=ClearRollMappingsResponse)
def clear_roll_mappings(
    academic_year: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    deleted_count = db.execute(
        delete(RollNumberMapping).where(RollNumberMapping.academic_year == academic_year)
    ).rowcount
    db.commit()
    return {
        "status": "success",
        "deleted_count": deleted_count,
    }
