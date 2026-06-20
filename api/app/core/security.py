from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


def hash_password(plain: str) -> str:
    # bcrypt limite l'entrée à 72 octets : on tronque proprement
    pw = plain.encode("utf-8")[:72]
    return bcrypt.hashpw(pw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pw = plain.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pw, hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(sub: str, claims: dict, expires: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "type": token_type,
        "iat": now,
        "exp": now + expires,
        **claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: str, account_type: str, role: str) -> str:
    # account_type et role portés dans le token : web + future app mobile
    return _create_token(
        sub=user_id,
        claims={"account_type": account_type, "role": role},
        expires=timedelta(minutes=settings.access_token_expire_minutes),
        token_type="access",
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        sub=user_id,
        claims={},
        expires=timedelta(days=settings.refresh_token_expire_days),
        token_type="refresh",
    )


def decode_token(token: str) -> dict:
    """Lève JWTError si invalide/expiré."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def create_password_reset_token(user_id: str) -> str:
    """Token courte durée pour le reset password (15 min)."""
    return _create_token(
        sub=user_id, claims={}, expires=timedelta(minutes=15),
        token_type="password_reset",
    )


def create_email_verify_token(user_id: str) -> str:
    """Token de vérification email (24h)."""
    return _create_token(
        sub=user_id, claims={}, expires=timedelta(hours=24),
        token_type="email_verify",
    )


def create_pre_2fa_token(user_id: str) -> str:
    """Token court (5 min) après vérification email/password.
    Doit être échangé contre un access token via /auth/admin/verify-2fa
    avec un code TOTP valide."""
    return _create_token(
        sub=user_id, claims={}, expires=timedelta(minutes=5),
        token_type="pre_2fa",
    )


def create_email_change_token(user_id: str, new_email: str) -> str:
    """Token de confirmation de changement d'email (24h)."""
    return _create_token(
        sub=user_id, claims={"new_email": new_email}, expires=timedelta(hours=24),
        token_type="email_change",
    )


def create_reauth_token(user_id: str) -> str:
    """Token court (5 min) prouvant qu'on vient de re-saisir son mot de passe.
    Utilisé pour les actions sensibles (delete account, disable 2FA)."""
    return _create_token(
        sub=user_id, claims={}, expires=timedelta(minutes=5),
        token_type="reauth",
    )
