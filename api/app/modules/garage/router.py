"""Garages partenaires : CRUD admin + recherche publique du plus proche."""
import re
import unicodedata
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.integrations.geocode import geocode, haversine_km
from app.models.garage import Garage
from app.models.user import User, UserRole
from app.schemas.garage import (
    GarageCreate,
    GarageNearby,
    GarageOut,
    GarageUpdate,
)

router = APIRouter(tags=["garages"])
_admin = require_role(UserRole.admin)


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "garage"


async def _unique_slug(
    db: AsyncSession, base: str, exclude_id: uuid.UUID | None = None
) -> str:
    slug = base
    n = 1
    while True:
        stmt = select(Garage.id).where(Garage.slug == slug)
        if exclude_id is not None:
            stmt = stmt.where(Garage.id != exclude_id)
        exists = await db.scalar(stmt)
        if not exists:
            return slug
        n += 1
        slug = f"{base}-{n}"


async def _geocode_into(g: Garage) -> None:
    """Géocode l'adresse du garage et remplit lat/lng (best effort)."""
    coords = await geocode(f"{g.address} {g.city}", postcode=g.postal_code)
    if coords:
        g.lat, g.lng = coords


# --------------------------------------------------------------------------
#  Admin : CRUD
# --------------------------------------------------------------------------

@router.get("/admin/garages", response_model=list[GarageOut])
async def admin_list_garages(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    rows = await db.scalars(select(Garage).order_by(Garage.name))
    return list(rows)


@router.post("/admin/garages", response_model=GarageOut, status_code=201)
async def admin_create_garage(
    data: GarageCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    g = Garage(
        **data.model_dump(exclude={"email"}),
        email=str(data.email) if data.email else None,
    )
    g.slug = await _unique_slug(db, _slugify(data.name))
    await _geocode_into(g)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return g


async def _get_garage(garage_id: uuid.UUID, db: AsyncSession) -> Garage:
    g = await db.get(Garage, garage_id)
    if g is None:
        raise HTTPException(status_code=404, detail="Garage introuvable")
    return g


@router.get("/admin/garages/{garage_id}", response_model=GarageOut)
async def admin_get_garage(
    garage_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    return await _get_garage(garage_id, db)


@router.patch("/admin/garages/{garage_id}", response_model=GarageOut)
async def admin_update_garage(
    garage_id: uuid.UUID,
    data: GarageUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    g = await _get_garage(garage_id, db)
    fields = data.model_dump(exclude_unset=True)
    address_changed = any(
        k in fields and fields[k] != getattr(g, k)
        for k in ("address", "postal_code", "city")
    )
    if "email" in fields and fields["email"] is not None:
        fields["email"] = str(fields["email"])
    for k, v in fields.items():
        setattr(g, k, v)
    if "name" in fields and fields["name"]:
        g.slug = await _unique_slug(db, _slugify(g.name), exclude_id=g.id)
    if address_changed:
        await _geocode_into(g)
    await db.commit()
    await db.refresh(g)
    return g


@router.delete("/admin/garages/{garage_id}", status_code=204)
async def admin_delete_garage(
    garage_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    g = await _get_garage(garage_id, db)
    await db.delete(g)
    await db.commit()


# --------------------------------------------------------------------------
#  Public : garages les plus proches d'une adresse / d'un code postal
# --------------------------------------------------------------------------

@router.get("/garages/nearest", response_model=list[GarageNearby])
async def nearest_garages(
    postcode: str = Query(..., min_length=4, max_length=10),
    q: str | None = Query(None, description="Adresse ou ville pour affiner"),
    limit: int = Query(6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Garages publiés les plus proches, triés par distance."""
    origin = await geocode(q or postcode, postcode=postcode)
    rows = list(
        await db.scalars(
            select(Garage).where(
                Garage.is_published.is_(True),
                Garage.lat.is_not(None),
                Garage.lng.is_not(None),
            )
        )
    )

    def build(g: Garage) -> GarageNearby:
        item = GarageNearby.model_validate(g)
        if origin and g.lat is not None and g.lng is not None:
            item.distance_km = round(
                haversine_km(origin[0], origin[1], g.lat, g.lng), 1
            )
        return item

    items = [build(g) for g in rows]
    # Tri par distance (les garages sans distance calculable en dernier)
    items.sort(key=lambda i: i.distance_km if i.distance_km is not None else 1e9)
    return items[:limit]
