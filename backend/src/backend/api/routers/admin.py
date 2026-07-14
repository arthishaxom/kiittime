from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.api.schemas import (
    ApproveResponse,
    DiffSummary,
    InspectResponse,
    RejectResponse,
    SessionDetail,
    UploadResponse,
)
from backend.auth.dependencies import get_current_admin
from backend.db.models import AdminUser, BronzeSnapshot, SnapshotStatus
from backend.db.session import get_db
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
            status.HTTP_422_UNPROCESSABLE_ENTITY,
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
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to read Excel file: {e}",
        )

    if sheet_name not in xl.sheet_names:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Sheet {sheet_name!r} not found. Available sheets: {xl.sheet_names}",
        )

    df = xl.parse(sheet_name=sheet_name)

    try:
        rows = parse_section_grid(df, year=year)
    except Exception as e:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

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
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
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
