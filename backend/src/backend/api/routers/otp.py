import os
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas import OTPSendRequest, OTPSendResponse, OTPVerifyRequest, OTPVerifyResponse
from backend.db.models import OTPVerification, RollNumberMapping, Section
from backend.db.session import get_db
from backend.email import ConsoleEmailProvider, EmailProvider, ResendEmailProvider

router = APIRouter(prefix="/api/auth/otp", tags=["otp"])

_provider: EmailProvider | None = None


def get_email_provider() -> EmailProvider:
    global _provider
    if _provider is not None:
        return _provider
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    if api_key:
        _provider = ResendEmailProvider(api_key, from_email)
    else:
        _provider = ConsoleEmailProvider()
    return _provider


@router.post("/send", response_model=OTPSendResponse)
def send_otp(
    payload: OTPSendRequest,
    db: Session = Depends(get_db),
    email_provider: EmailProvider = Depends(get_email_provider),
) -> Any:
    # Validate roll number
    roll_no = payload.roll_no.strip()
    if not roll_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Roll number cannot be empty",
        )

    # Validate section ids
    if not payload.section_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one section must be specified",
        )

    # Check if all sections exist
    existing_sections = db.execute(
        select(Section).where(Section.id.in_(payload.section_ids))
    ).scalars().all()

    if len(existing_sections) != len(set(payload.section_ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more specified sections do not exist",
        )

    # Generate 6-digit OTP code
    otp_code = f"{random.randint(100000, 999999)}"

    # Set expiration (10 minutes from now)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    # Create OTP verification record
    verification = OTPVerification(
        roll_no=roll_no,
        otp_code=otp_code,
        section_ids=payload.section_ids,
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()

    # Derive email address
    email_address = f"{roll_no}@kiit.ac.in"

    # Send email
    subject = "KIIT Time Timetable Link Verification Code"
    html = f"""
    <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>KIIT Time Authentication</h2>
        <p>You requested to link your roll number <strong>{roll_no}</strong> to your timetable sections.</p>
        <p>Your verification OTP code is:</p>
        <div style="font-size: 24px; font-weight: bold; background: #f0f0f0; padding: 10px 20px; border-radius: 5px; display: inline-block; letter-spacing: 2px; margin: 10px 0;">
            {otp_code}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666;">If you did not make this request, please ignore this email.</p>
    </div>
    """

    sent = email_provider.send_email(to=email_address, subject=subject, html=html)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP email",
        )

    return {"status": "ok", "message": "OTP sent successfully"}


@router.post("/verify", response_model=OTPVerifyResponse)
def verify_otp(
    payload: OTPVerifyRequest,
    db: Session = Depends(get_db),
) -> Any:
    roll_no = payload.roll_no.strip()
    otp_code = payload.otp_code.strip()

    # Query active verification
    now_utc = datetime.now(timezone.utc)
    verification = db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.roll_no == roll_no,
            OTPVerification.is_verified == False,
            OTPVerification.expires_at > now_utc,
        )
        .order_by(OTPVerification.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not verification or verification.otp_code != otp_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    # Mark OTP as verified
    verification.is_verified = True

    # Retrieve sections
    sections = db.execute(
        select(Section).where(Section.id.in_(verification.section_ids))
    ).scalars().all()

    if not sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid sections found for the verification mapping",
        )

    # Academic year is derived from the first section
    academic_year = sections[0].year

    # Create mapping entries
    created_mappings = []
    for section in sections:
        # Check if mapping already exists
        exists = db.execute(
            select(RollNumberMapping).where(
                RollNumberMapping.roll_no == roll_no,
                RollNumberMapping.section_id == section.id,
            )
        ).scalar_one_or_none()

        if not exists:
            mapping = RollNumberMapping(
                roll_no=roll_no,
                section_id=section.id,
                academic_year=academic_year,
            )
            db.add(mapping)
            created_mappings.append(mapping)

    db.commit()

    return {
        "status": "ok",
        "academic_year": academic_year,
        "sections": sections,
    }
