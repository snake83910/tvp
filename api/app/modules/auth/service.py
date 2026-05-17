from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.models.user import AccountType, ProProfile, User
from app.schemas.auth import RegisterIn


async def register_user(db: AsyncSession, data: RegisterIn) -> User:
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte existe déjà avec cet email",
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
    await db.flush()  # obtient user.id

    if data.account_type == AccountType.pro and data.pro:
        db.add(
            ProProfile(
                user_id=user.id,
                company_name=data.pro.company_name,
                siret=data.pro.siret,
                vat_number=data.pro.vat_number,
                # vat_validated reste False : validation VIES en phase ultérieure
            )
        )

    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé",
        )
    return user


def issue_tokens(user: User) -> dict:
    return {
        "access_token": create_access_token(
            str(user.id), user.account_type.value, user.role.value
        ),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
    }
