import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas import OTPSendRequest, OTPSendResponse, OTPVerifyRequest, OTPVerifyResponse
from backend.auth.security import hash_password, verify_password
from backend.db.models import RollNumberMapping, Section
from backend.db.session import get_db
from backend.email import ConsoleEmailProvider, EmailProvider, ResendEmailProvider
from backend.redis import get_redis

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
    redis_conn=Depends(get_redis),
    email_provider: EmailProvider = Depends(get_email_provider),
) -> Any:
    # Validate roll number
    roll_no = payload.roll_no.strip()
    if not roll_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Roll number cannot be empty",
        )

    # Check lockout
    lockout_ttl = redis_conn.ttl(f"lockout:{roll_no}")
    if lockout_ttl > 0:
        minutes = lockout_ttl // 60
        seconds = lockout_ttl % 60
        time_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Account locked. Try again in {time_str}.",
        )

    # Check resend cooldown
    cooldown_ttl = redis_conn.ttl(f"cooldown:{roll_no}")
    if cooldown_ttl > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {cooldown_ttl} seconds before requesting a new OTP.",
        )

    # Check hourly rate limit
    send_count = redis_conn.get(f"send_count:{roll_no}")
    if send_count and int(send_count) >= 5:
        send_count_ttl = redis_conn.ttl(f"send_count:{roll_no}")
        minutes = max(0, send_count_ttl // 60)
        time_str = f"{minutes}m" if minutes > 0 else f"{send_count_ttl}s"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Max 5 OTP requests per hour. Try again in {time_str}.",
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

    # Generate 6-digit OTP code securely
    otp_code = f"{secrets.SystemRandom().randint(100000, 999999)}"

    # Hash OTP and store in Redis (300 seconds TTL = 5 minutes)
    otp_hash = hash_password(otp_code)
    otp_data = {
        "otp_hash": otp_hash,
        "section_ids": payload.section_ids,
        "attempts_left": 3,
    }
    # Save to Redis
    redis_conn.set(f"otp:{roll_no}", json.dumps(otp_data), ex=300)

    # Set 60-second resend cooldown
    redis_conn.set(f"cooldown:{roll_no}", "1", ex=60)

    # Increment and check rate limit window
    pipe = redis_conn.pipeline()
    pipe.incr(f"send_count:{roll_no}")
    pipe.ttl(f"send_count:{roll_no}")
    res = pipe.execute()
    count = res[0]
    current_ttl = res[1]
    if current_ttl < 0:
        redis_conn.expire(f"send_count:{roll_no}", 3600)

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
        <p>This code will expire in 5 minutes.</p>
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
    redis_conn=Depends(get_redis),
) -> Any:
    roll_no = payload.roll_no.strip()
    otp_code = payload.otp_code.strip()

    # Check lockout
    lockout_ttl = redis_conn.ttl(f"lockout:{roll_no}")
    if lockout_ttl > 0:
        minutes = lockout_ttl // 60
        seconds = lockout_ttl % 60
        time_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Account locked. Try again in {time_str}.",
        )

    # Retrieve OTP data
    otp_data_raw = redis_conn.get(f"otp:{roll_no}")
    if not otp_data_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    otp_data = json.loads(otp_data_raw)

    # Verify OTP hash
    if not verify_password(otp_code, otp_data["otp_hash"]):
        attempts_left = otp_data["attempts_left"] - 1
        if attempts_left <= 0:
            # Delete OTP and lockout
            redis_conn.delete(f"otp:{roll_no}")
            redis_conn.set(f"lockout:{roll_no}", "1", ex=900)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts. Account locked. Try again in 15 minutes.",
            )
        else:
            otp_data["attempts_left"] = attempts_left
            ttl = redis_conn.ttl(f"otp:{roll_no}")
            if ttl > 0:
                redis_conn.set(f"otp:{roll_no}", json.dumps(otp_data), ex=ttl)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or expired OTP code. {attempts_left} attempts remaining.",
            )

    # OTP is valid, delete it
    redis_conn.delete(f"otp:{roll_no}")

    # Retrieve sections
    sections = db.execute(
        select(Section).where(Section.id.in_(otp_data["section_ids"]))
    ).scalars().all()

    if not sections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid sections found for the verification mapping",
        )

    # Academic year is derived from the first section
    academic_year = sections[0].year

    # Create mapping entries
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

    db.commit()

    return {
        "status": "ok",
        "academic_year": academic_year,
        "sections": sections,
    }

