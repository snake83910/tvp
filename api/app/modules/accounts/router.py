import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import Address, User
from app.schemas.auth import AddressIn, AddressOut, UserOut

router = APIRouter(prefix="/me", tags=["account"])


@router.get("/profile", response_model=UserOut)
async def get_profile(user: User = Depends(get_current_user)):
    return user


@router.get("/addresses", response_model=list[AddressOut])
async def list_addresses(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.scalars(
        select(Address).where(Address.user_id == user.id)
    )
    return list(rows)


@router.post("/addresses", response_model=AddressOut, status_code=201)
async def add_address(
    data: AddressIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = Address(user_id=user.id, **data.model_dump())
    if addr.is_default:
        # une seule adresse par défaut
        existing = await db.scalars(
            select(Address).where(
                Address.user_id == user.id, Address.is_default.is_(True)
            )
        )
        for a in existing:
            a.is_default = False
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.delete("/addresses/{address_id}", status_code=204)
async def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    addr = await db.get(Address, address_id)
    if addr is None or addr.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adresse introuvable")
    await db.delete(addr)
    await db.commit()
