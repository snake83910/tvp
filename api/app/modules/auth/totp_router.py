"""Gestion du 2FA TOTP (Google Authenticator, Authy, 1Password, ...).

Flux d'enrôlement :
  1. POST /auth/2fa/setup -> retourne un secret + URL otpauth + QR code base64
  2. L'utilisateur scanne le QR avec son app
  3. POST /auth/2fa/enable {code} -> valide le code et active 2FA

Flux de connexion (admin) :
  1. POST /auth/login -> renvoie un token "pre_2fa" si user.totp_enabled
  2. POST /auth/2fa/verify {code} -> renvoie le token JWT final

Pour l'instant, vue admin uniquement. À élargir aux comptes pro si besoin.
"""
import base64
import io
from typing import Annotated

import pyotp
import qrcode
from fastapi import APIRouter, Body, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth/2fa", tags=["auth"])

_ISSUER = "Tous Vos Pneus"


@router.post("/setup")
async def setup_totp(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Génère un secret + QR code à scanner.

    Le secret est sauvegardé mais totp_enabled reste False tant que
    l'utilisateur n'a pas validé un premier code via /enable.
    """
    if user.totp_enabled:
        raise HTTPException(
            status_code=400, detail="2FA déjà activé. Désactivez-le d'abord."
        )

    secret = pyotp.random_base32()
    user.totp_secret = secret
    await db.commit()

    otpauth = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=_ISSUER)

    img = qrcode.make(otpauth)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "secret": secret,
        "otpauth_url": otpauth,
        "qr_png_base64": qr_b64,
    }


@router.post("/enable", status_code=204)
async def enable_totp(
    code: Annotated[str, Body(embed=True)],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active 2FA après vérification du premier code."""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Appelez d'abord /setup")
    if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Code incorrect")
    user.totp_enabled = True
    await db.commit()
    return None


@router.post("/disable", status_code=204)
async def disable_totp(
    code: Annotated[str, Body(embed=True)],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Désactive le 2FA après vérification d'un code valide."""
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA non activé")
    if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code incorrect")
    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()
    return None


@router.get("/status")
async def status_totp(user: User = Depends(get_current_user)):
    """Statut du 2FA pour le user courant."""
    return {"enabled": user.totp_enabled}
