import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_credentials_exc = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Identifiants invalides",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise _credentials_exc
        user_id = payload.get("sub")
        if user_id is None:
            raise _credentials_exc
        # ValueError : sub non-UUID -> 401, pas 500
        uid = uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise _credentials_exc from None

    user = await db.get(User, uid)
    if user is None or not user.is_active:
        raise _credentials_exc
    return user


def require_role(*roles: UserRole):
    """Garde de rôle : require_role(UserRole.admin)."""

    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé pour ce rôle",
            )
        return user

    return _checker


async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(
        OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
    ),
) -> User | None:
    """Recherche accessible sans compte : prix particulier par défaut.

    IMPORTANT : pas de token -> anonyme (None). Mais un token PRÉSENT
    et invalide/expiré -> 401. Sans ça, un client dont l'access token
    a expiré voyait ses ajouts panier partir silencieusement dans un
    panier anonyme fantôme (l'UI le montre connecté, le panier se vide).
    Le 401 déclenche le refresh automatique côté front, qui rejoue la
    requête avec un token valide."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise _credentials_exc
        user_id = payload.get("sub")
        if user_id is None:
            raise _credentials_exc
        uid = uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise _credentials_exc from None
    user = await db.get(User, uid)
    if user is None or not user.is_active:
        raise _credentials_exc
    return user
