from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.net import client_ip
from app.core.password_policy import is_pwned, validate_password
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.security import LoginLog, RefreshToken
from app.models.user import AccountType, ProProfile, User
from app.schemas.auth import RegisterIn

LOCKOUT_THRESHOLD = 10
LOCKOUT_DURATION = timedelta(minutes=15)


def _client_meta(request: Request | None) -> tuple[str | None, str | None]:
    if request is None:
        return None, None
    ip = client_ip(request)
    ua = request.headers.get("user-agent", "")[:500] or None
    return ip, ua


async def register_user(db: AsyncSession, data: RegisterIn) -> User:
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email",
        )

    # Politique mot de passe
    err = validate_password(data.password)
    if err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err)
    if await is_pwned(data.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ce mot de passe a été exposé dans une fuite de données. Choisissez-en un autre.",
        )

    if data.account_type == AccountType.pro and data.pro is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Les informations société sont requises pour un compte pro",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        account_type=data.account_type,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
    )
    db.add(user)
    await db.flush()

    if data.account_type == AccountType.pro and data.pro:
        db.add(
            ProProfile(
                user_id=user.id,
                company_name=data.pro.company_name,
                siret=data.pro.siret,
                vat_number=data.pro.vat_number,
            )
        )

    try:
        await db.commit()
    except IntegrityError:
        # Course avec une inscription simultanée sur le même email :
        # le check-then-insert du début ne suffit pas, la contrainte
        # UNIQUE tranche. Même réponse que le doublon détecté plus haut.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email",
        )
    await db.refresh(user)
    return user


async def authenticate(
    db: AsyncSession,
    email: str,
    password: str,
    request: Request | None = None,
) -> User:
    """Authentifie en gérant lockout + log."""
    ip, ua = _client_meta(request)
    email_norm = email.lower().strip()
    user = await db.scalar(select(User).where(User.email == email_norm))

    # Lockout : si bloqué, refuser même si le password est bon
    now = datetime.now(timezone.utc)
    if user and user.locked_until and user.locked_until > now:
        db.add(LoginLog(user_id=user.id, email=email_norm, success=False,
                         reason="locked", ip=ip, user_agent=ua))
        await db.commit()
        seconds = int((user.locked_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Compte temporairement verrouillé. Réessayez dans {seconds}s.",
        )

    if user is None or not verify_password(password, user.password_hash):
        # Échec : si le compte existe, incrémente le compteur
        if user is not None:
            user.failed_login_count = (user.failed_login_count or 0) + 1
            if user.failed_login_count >= LOCKOUT_THRESHOLD:
                user.locked_until = now + LOCKOUT_DURATION
                user.failed_login_count = 0
        db.add(LoginLog(
            user_id=user.id if user else None,
            email=email_norm, success=False,
            reason="bad_password" if user else "unknown_email",
            ip=ip, user_agent=ua,
        ))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    if not user.is_active:
        db.add(LoginLog(user_id=user.id, email=email_norm, success=False,
                         reason="inactive", ip=ip, user_agent=ua))
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )

    # Succès : reset le compteur + log
    user.failed_login_count = 0
    user.locked_until = None
    db.add(LoginLog(user_id=user.id, email=email_norm, success=True,
                     reason=None, ip=ip, user_agent=ua))
    await db.commit()
    return user


# ── Refresh tokens : rotation + détection réutilisation ──────────

def _hash_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


async def issue_token_pair(
    db: AsyncSession, user: User, request: Request | None = None
) -> dict:
    """Émet access + refresh tokens. Le refresh est tracé en DB."""
    from app.core.config import settings

    access = create_access_token(str(user.id), user.account_type.value, user.role.value)
    refresh_jwt = create_refresh_token(str(user.id))
    ip, _ = _client_meta(request)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_jwt),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        ip=ip,
    ))
    await db.commit()
    return {
        "access_token": access,
        "refresh_token": refresh_jwt,
        "token_type": "bearer",
    }


async def revoke_all_refresh_tokens(db: AsyncSession, user_id) -> None:
    """Révoque toutes les sessions d'un user. À appeler après tout
    changement de mot de passe : une session volée ne doit pas survivre
    au reset. Ne commit pas (l'appelant commit avec le reste)."""
    await db.execute(
        RefreshToken.__table__.update()
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )


async def rotate_refresh_token(
    db: AsyncSession, presented_refresh: str, request: Request | None = None
) -> dict:
    """Vérifie le refresh présenté + le révoque + émet le suivant.

    Si on présente un refresh déjà révoqué (mais pas expiré), c'est une
    REUTILISATION suspecte : on révoque toute la chaîne pour ce user.
    """
    import uuid
    from jose import JWTError

    from app.core.security import decode_token
    try:
        payload = decode_token(presented_refresh)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")

    token_hash = _hash_token(presented_refresh)
    rt = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if rt is None:
        # Token jamais émis ou ancien — refuse
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inconnu")

    now = datetime.now(timezone.utc)
    if rt.expires_at <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expiré")

    if rt.revoked_at is not None:
        # RÉUTILISATION : on révoque toute la chaîne du user (compromission probable)
        await db.execute(
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == rt.user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await db.commit()
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Token déjà utilisé. Tous vos tokens ont été révoqués pour votre sécurité.",
        )

    try:
        uid = uuid.UUID(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide")
    user = await db.get(User, uid)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Compte invalide")

    # Émet le nouveau et lie l'ancien
    new_tokens = await issue_token_pair(db, user, request)
    new_hash = _hash_token(new_tokens["refresh_token"])
    new_rt = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == new_hash))
    rt.revoked_at = now
    rt.replaced_by = new_rt.id if new_rt else None
    await db.commit()
    return new_tokens
