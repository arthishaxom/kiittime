from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.api.schemas import TokenOut
from backend.auth.dependencies import get_current_admin
from backend.auth.security import hash_password, verify_password
from backend.auth.tokens import create_access_token
from backend.db.models import AdminUser
from backend.db.session import get_db

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = hash_password("dummy")


@router.post("/login", response_model=TokenOut)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.execute(
        select(AdminUser).where(AdminUser.username == form_data.username)
    ).scalar_one_or_none()

    stored = user.hashed_password if user is not None else _DUMMY_HASH
    if not verify_password(form_data.password, stored):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=form_data.username)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def get_me(current_admin: AdminUser = Depends(get_current_admin)) -> dict[str, str]:
    return {"username": current_admin.username}
