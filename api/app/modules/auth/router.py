import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.modules.auth.service import authenticate, issue_tokens, register_user
from app.modules.mailer.service import send_welcome
from app.schemas.auth import (
    LoginIn,
    RefreshIn,
    RegisterIn,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(
    data: RegisterIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # 3 inscriptions max / heure / IP : bloque la création de comptes en masse
    await rate_limit(request, "register", max_attempts=3, window_seconds=3600)
    user = await register_user(db, data)
    send_welcome(user)
    return user


@router.post("/login", response_model=TokenPair)
async def login(
    data: LoginIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # 5 tentatives max / minute / IP : bloque le brute force basique
    await rate_limit(request, "login", max_attempts=5, window_seconds=60)
    user = await authenticate(db, data.email, data.password)
    return issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshIn, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")

    user = await db.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")
    return issue_tokens(user)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
