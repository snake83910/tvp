"""Garages partenaires : CRUD admin, portail partenaire, pages publiques
et recherche du plus proche."""
import re
import secrets
import unicodedata
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_role
from app.core.rate_limit import rate_limit
from app.core.security import create_password_reset_token, hash_password
from app.core.storage import document_path, save_document
from app.integrations.geocode import geocode, haversine_km
from app.models.garage import Garage
from app.models.order import Order, OrderStatus
from app.models.user import User, UserRole
from app.modules.auth.service import issue_token_pair
from app.modules.mailer.service import (
    send_admin_new_garage,
    send_password_reset,
    send_welcome,
)
from app.schemas.auth import TokenPair
from app.schemas.garage import (
    GarageCreate,
    GarageNearby,
    GarageOut,
    GaragePublic,
    GarageUpdate,
    OwnerIn,
    PartnerOrder,
    PartnerOrderItem,
)

router = APIRouter(tags=["garages"])
_admin = require_role(UserRole.admin)
_garage_user = require_role(UserRole.garage)

# Statuts d'une commande visibles par le garage : à partir du paiement.
_VISIBLE_ORDER_STATUSES = {
    OrderStatus.paid,
    OrderStatus.sent_to_supplier,
    OrderStatus.shipped,
    OrderStatus.delivered,
}


def _dimension_of(product_data: dict | None) -> str | None:
    pd = product_data or {}
    if pd.get("dimension"):
        return str(pd["dimension"])
    w, r, d = pd.get("width"), pd.get("ratio"), pd.get("diameter")
    if w and r and d:
        return f"{w}/{r} R{d}"
    return None


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


# --------------------------------------------------------------------------
#  Admin : rattachement d'un compte gérant
# --------------------------------------------------------------------------

@router.put("/admin/garages/{garage_id}/owner", response_model=GarageOut)
async def admin_set_owner(
    garage_id: uuid.UUID,
    data: OwnerIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    """Rattache (ou crée) le compte gérant du garage (rôle garage).

    Compte inexistant -> création + email pour définir le mot de passe.
    """
    g = await _get_garage(garage_id, db)
    email = str(data.email).lower().strip()
    user = await db.scalar(select(User).where(User.email == email))
    invited = False
    if user is None:
        user = User(
            email=email,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            role=UserRole.garage,
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        invited = True
    elif user.role == UserRole.client:
        user.role = UserRole.garage
    g.owner_user_id = user.id
    await db.commit()
    await db.refresh(g)
    if invited:
        send_password_reset(user, create_password_reset_token(str(user.id)))
    return g


@router.get("/admin/garages/{garage_id}/kbis")
async def admin_download_kbis(
    garage_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_admin),
):
    """Télécharge le Kbis d'un garage (vérification anti-fraude)."""
    g = await _get_garage(garage_id, db)
    if not g.kbis_path:
        raise HTTPException(status_code=404, detail="Aucun Kbis pour ce garage")
    path = document_path(g.kbis_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return FileResponse(path, filename=f"kbis-{g.slug}{path.suffix}")


# --------------------------------------------------------------------------
#  Page publique d'un garage
# --------------------------------------------------------------------------

@router.get("/garages/{slug}", response_model=GaragePublic)
async def public_garage(slug: str, db: AsyncSession = Depends(get_db)):
    g = await db.scalar(
        select(Garage).where(Garage.slug == slug, Garage.is_published.is_(True))
    )
    if g is None:
        raise HTTPException(status_code=404, detail="Garage introuvable")
    return g


# --------------------------------------------------------------------------
#  Portail partenaire (rôle garage) : gère sa page + voit ses commandes
# --------------------------------------------------------------------------

@router.post("/partner/register", response_model=TokenPair, status_code=201)
async def partner_register(
    request: Request,
    email: str = Form(...),
    password: str = Form(..., min_length=8, max_length=128),
    garage_name: str = Form(..., min_length=1, max_length=200),
    address: str = Form(..., min_length=1, max_length=300),
    postal_code: str = Form(..., min_length=4, max_length=10),
    city: str = Form(..., min_length=1, max_length=120),
    siret: str = Form(..., min_length=9, max_length=20),
    phone: str | None = Form(None),
    kbis: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Auto-inscription d'un garage : crée le compte (rôle garage) et sa
    fiche garage (non publiée, en attente de validation admin), stocke le
    SIRET et le Kbis, puis connecte directement le partenaire."""
    await rate_limit(request, "partner_register", max_attempts=3, window_seconds=3600)
    email = email.lower().strip()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Email invalide")
    siret_clean = "".join(c for c in siret if c.isdigit())
    if len(siret_clean) != 14:
        raise HTTPException(
            status_code=422, detail="Le SIRET doit comporter 14 chiffres"
        )
    existing = await db.scalar(select(User).where(User.email == email))
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="Un compte existe déjà avec cet email"
        )
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=UserRole.garage,
        is_active=True,
        email_verified=True,
        phone=phone,
    )
    db.add(user)
    await db.flush()

    g = Garage(
        owner_user_id=user.id,
        name=garage_name,
        address=address,
        postal_code=postal_code,
        city=city,
        phone=phone,
        email=email,
        siret=siret_clean,
        is_published=False,  # publication après validation admin
    )
    g.slug = await _unique_slug(db, _slugify(garage_name))
    await _geocode_into(g)
    db.add(g)
    await db.flush()

    if kbis is not None and kbis.filename:
        g.kbis_path = await save_document("kbis", str(g.id), kbis)

    await db.commit()

    send_welcome(user)
    send_admin_new_garage(g)
    return await issue_token_pair(db, user, request)


async def _own_garage(db: AsyncSession, user: User) -> Garage:
    g = await db.scalar(select(Garage).where(Garage.owner_user_id == user.id))
    if g is None:
        raise HTTPException(
            status_code=404, detail="Aucun garage associé à ce compte"
        )
    return g


@router.get("/partner/garage", response_model=GarageOut)
async def partner_get_garage(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_garage_user),
):
    return await _own_garage(db, user)


@router.patch("/partner/garage", response_model=GarageOut)
async def partner_update_garage(
    data: GarageUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_garage_user),
):
    g = await _own_garage(db, user)
    fields = data.model_dump(exclude_unset=True)
    # La publication reste une décision admin.
    fields.pop("is_published", None)
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


@router.get("/partner/orders", response_model=list[PartnerOrder])
async def partner_orders(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_garage_user),
):
    """Commandes rattachées au garage, SANS les prix (montage payé sur place)."""
    g = await _own_garage(db, user)
    orders = list(
        await db.scalars(
            select(Order)
            .where(
                Order.garage_id == g.id,
                Order.status.in_(_VISIBLE_ORDER_STATUSES),
            )
            .options(selectinload(Order.items))
            .order_by(Order.created_at.desc())
        )
    )
    out: list[PartnerOrder] = []
    for o in orders:
        cust = await db.get(User, o.user_id)
        name = None
        if cust:
            name = f"{cust.first_name or ''} {cust.last_name or ''}".strip() or None
        out.append(
            PartnerOrder(
                order_number=o.order_number,
                status=o.status.value,
                created_at=o.created_at.isoformat(),
                customer_name=name,
                customer_phone=cust.phone if cust else None,
                customer_email=cust.email if cust else None,
                items=[
                    PartnerOrderItem(
                        label=it.label_snapshot,
                        quantity=it.quantity,
                        dimension=_dimension_of(it.product_data),
                    )
                    for it in o.items
                ],
            )
        )
    return out
