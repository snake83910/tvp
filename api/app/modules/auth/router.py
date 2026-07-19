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
from app.core.cache import get_redis
from app.modules.auth.service import (
    authenticate,
    issue_token_pair,
    register_user,
    revoke_all_refresh_tokens,
    rotate_refresh_token,
)
from app.modules.mailer.service import (
    send_email_change_confirm,
    send_email_changed_notice,
    send_login_alert,
    send_password_reset,
    send_verify_email,
    send_welcome,
)
from app.schemas.auth import (
    AdminLoginOut,
    EmailChangeConfirmIn,
    EmailChangeRequestIn,
    ForgotPasswordIn,
    LoginIn,
    ReauthIn,
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
    user = await authenticate(db, data.email, data.password, request)
    return await issue_token_pair(db, user, request)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    data: RefreshIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Rotation : le refresh présenté est invalidé, un nouveau est émis.
    Si on présente un refresh déjà révoqué, toute la chaîne du user est
    révoquée (réutilisation = vol probable)."""
    return await rotate_refresh_token(db, data.refresh_token, request)


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
    """Applique le nouveau mot de passe si le token est valide.

    Le token est à USAGE UNIQUE (jti marqué consommé dans Redis) et le
    reset révoque toutes les sessions : un refresh token volé avant le
    reset ne survit pas."""
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

    # Policy + HIBP — AVANT de consommer le jti : un mot de passe refusé
    # ne doit pas griller le lien de reset.
    from app.core.password_policy import is_pwned, validate_password
    err = validate_password(data.new_password)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    if await is_pwned(data.new_password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ce mot de passe a été exposé dans une fuite. Choisissez-en un autre.",
        )

    # Usage unique : SET NX réclame le jti ATOMIQUEMENT avant d'appliquer
    # le reset (un GET puis SET séparés laissaient deux requêtes
    # simultanées consommer le même lien). TTL aligné sur la durée de
    # vie du token : après expiration du JWT, la clé n'a plus d'utilité.
    jti = payload.get("jti")
    if jti:
        claimed = await get_redis().set(
            f"pwreset:used:{jti}", "1", ex=15 * 60, nx=True
        )
        if not claimed:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien déjà utilisé")

    user.password_hash = hash_password(data.new_password)
    await revoke_all_refresh_tokens(db, user.id)
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
    user = await authenticate(db, data.email, data.password, request)
    if user.role != UserRole.admin:
        # Même message qu'un mauvais password : pas d'énumération des admins
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # Alerte par email sur toute connexion admin
    from app.core.net import client_ip
    ua = request.headers.get("user-agent", "")[:200]
    send_login_alert(user, client_ip(request) or "", ua)

    if user.totp_enabled:
        return AdminLoginOut(
            requires_2fa=True,
            pre_2fa_token=create_pre_2fa_token(str(user.id)),
        )

    tokens = await issue_token_pair(db, user, request)
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
    code = data.code.strip()
    ok = pyotp.TOTP(user.totp_secret).verify(code, valid_window=1)
    # Fallback : code de secours (8 chars alphanum)
    if not ok and user.totp_backup_codes:
        import bcrypt
        remaining = []
        used = False
        for hashed in user.totp_backup_codes:
            if not used and bcrypt.checkpw(code.encode(), hashed.encode()):
                used = True  # consommé : on ne le re-ajoute pas
            else:
                remaining.append(hashed)
        if used:
            user.totp_backup_codes = remaining
            ok = True
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Code 2FA incorrect")

    return await issue_token_pair(db, user, request)


# ── Re-auth (mot de passe) avant action sensible ──────────────────

@router.post("/reauth")
async def reauth(
    data: ReauthIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Demande le mot de passe actuel. Retourne un reauth_token court (5 min)."""
    await rate_limit(request, "reauth", max_attempts=5, window_seconds=60)
    from app.core.security import create_reauth_token, verify_password
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Mot de passe incorrect")
    return {"reauth_token": create_reauth_token(str(user.id))}


def _check_reauth_token(token: str, user_id: str) -> None:
    """Valide un reauth_token (type + porteur). 401 sinon."""
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Confirmation expirée, re-saisissez votre mot de passe",
        )
    if payload.get("type") != "reauth" or payload.get("sub") != user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Confirmation invalide")


# ── Demande de changement d'email ──────────────────────────────────

@router.post("/request-email-change", status_code=204)
async def request_email_change(
    data: EmailChangeRequestIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Rate limit : cet endpoint envoie un email à une adresse arbitraire,
    # sans limite il servirait de canon à spam avec notre expéditeur.
    await rate_limit(request, "email_change", max_attempts=3, window_seconds=600)
    # Action sensible : exige une re-saisie récente du mot de passe.
    _check_reauth_token(data.reauth_token, str(user.id))

    from app.core.security import create_email_change_token
    new_email = data.new_email
    existing = await db.scalar(select(User).where(User.email == new_email))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email déjà utilisé")
    token = create_email_change_token(str(user.id), new_email)
    send_email_change_confirm(user, new_email, token)
    return None


@router.post("/confirm-email-change", status_code=204)
async def confirm_email_change(
    payload: EmailChangeConfirmIn,
    db: AsyncSession = Depends(get_db),
):
    try:
        data = decode_token(payload.token)
    except JWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide ou expiré")
    if data.get("type") != "email_change":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide")
    user = await db.get(User, uuid.UUID(data["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Compte introuvable")
    new_email = data.get("new_email")
    if not new_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email manquant")
    # Vérifier qu'aucun autre compte ne l'a pris entre temps
    existing = await db.scalar(select(User).where(User.email == new_email))
    if existing and existing.id != user.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email déjà utilisé")
    old_email = user.email
    user.email = new_email
    user.email_verified = True
    # L'identifiant de connexion vient de changer : on invalide toutes
    # les sessions ouvertes (un token volé ne doit pas survivre).
    await revoke_all_refresh_tokens(db, user.id)
    await db.commit()
    # Prévenir l'ANCIENNE adresse : si le changement n'est pas légitime,
    # c'est la seule chance du titulaire de réagir.
    if old_email != new_email:
        send_email_changed_notice(old_email, user, new_email)
    return None
