import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_email_verify_token,
    create_password_reset_token,
    create_pre_2fa_token,
    decode_token,
    hash_password,
)
from app.models.user import UserRole
from app.db.session import get_db
from app.models.user import User
from app.modules.auth.service import authenticate, issue_tokens, register_user
from app.modules.mailer.service import (
    send_password_reset,
    send_verify_email,
    send_welcome,
)
from app.schemas.auth import (
    AdminLoginOut,
    ForgotPasswordIn,
    LoginIn,
    RefreshIn,
    RegisterIn,
    ResetPasswordIn,
    TokenPair,
    UserOut,
    Verify2faIn,
    VerifyEmailIn,
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
    # Token de vérification email envoyé en parallèle
    token = create_email_verify_token(str(user.id))
    send_verify_email(user, token)
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


@router.post("/forgot-password", status_code=204)
async def forgot_password(
    data: ForgotPasswordIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Demande de reset password.

    SÉCURITÉ : on retourne TOUJOURS 204, qu'importe que l'email existe ou
    non. Sinon on permettrait à un attaquant d'énumérer les comptes.
    """
    await rate_limit(request, "forgot", max_attempts=3, window_seconds=600)
    user = await db.scalar(select(User).where(User.email == data.email.lower()))
    if user and user.is_active:
        token = create_password_reset_token(str(user.id))
        send_password_reset(user, token)
    # Réponse identique dans tous les cas
    return None


@router.post("/reset-password", status_code=204)
async def reset_password(
    data: ResetPasswordIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Applique le nouveau mot de passe si le token est valide."""
    await rate_limit(request, "reset", max_attempts=10, window_seconds=600)
    try:
        payload = decode_token(data.token)
    except JWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien expiré ou invalide")
    if payload.get("type") != "password_reset":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Compte introuvable")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return None


@router.post("/verify-email", status_code=204)
async def verify_email(
    data: VerifyEmailIn,
    db: AsyncSession = Depends(get_db),
):
    """Marque l'email comme vérifié si le token est valide."""
    try:
        payload = decode_token(data.token)
    except JWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien expiré ou invalide")
    if payload.get("type") != "email_verify":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Compte introuvable")

    if not user.email_verified:
        user.email_verified = True
        await db.commit()
    return None


# ── Login admin séparé avec 2FA bloquant ──────────────────────────

@router.post("/admin/login", response_model=AdminLoginOut)
async def admin_login(
    data: LoginIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Login dédié aux admins.

    Vérifie email/password ET role == admin. Si l'admin a activé le 2FA,
    retourne un pre_2fa_token à échanger via /auth/admin/verify-2fa avec
    un code TOTP valide.
    """
    await rate_limit(request, "admin_login", max_attempts=5, window_seconds=60)
    user = await authenticate(db, data.email, data.password)
    if user.role != UserRole.admin:
        # Même message qu'un mauvais password : pas d'énumération des admins
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if user.totp_enabled:
        return AdminLoginOut(
            requires_2fa=True,
            pre_2fa_token=create_pre_2fa_token(str(user.id)),
        )

    tokens = issue_tokens(user)
    return AdminLoginOut(
        requires_2fa=False,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@router.post("/admin/verify-2fa", response_model=TokenPair)
async def admin_verify_2fa(
    data: Verify2faIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Échange un pre_2fa_token + code TOTP contre les tokens finaux."""
    await rate_limit(request, "admin_2fa", max_attempts=5, window_seconds=60)
    try:
        payload = decode_token(data.pre_2fa_token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée, recommencez")
    if payload.get("type") != "pre_2fa":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active or user.role != UserRole.admin:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Compte invalide")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "2FA non activé sur ce compte")

    import pyotp
    if not pyotp.TOTP(user.totp_secret).verify(data.code, valid_window=1):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Code 2FA incorrect")

    return issue_tokens(user)
