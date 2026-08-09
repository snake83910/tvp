"""
Routes panier & checkout.

Panier anonyme : le client reçoit un X-Cart-Session à renvoyer ensuite.
À la connexion, le front appelle /cart/merge pour fusionner.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_current_user_optional
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.models.order import Cart
from app.models.user import Address, User, UserRole
from app.modules.auth import service as auth_service
from app.modules.cart import service
from app.schemas.order import (
    AddItemIn,
    CartItemOut,
    CartOut,
    CheckoutIn,
    CheckoutResult,
    GuestCheckoutIn,
    GuestCheckoutResult,
    PromoValidateIn,
    PromoValidateOut,
    UpdateQtyIn,
)

router = APIRouter(prefix="/cart", tags=["cart"])


def _serialize(cart: Cart) -> CartOut:
    def _dimension(pd: dict) -> str | None:
        w, r, d = pd.get("width"), pd.get("ratio"), pd.get("diameter")
        if not (w and r and d):
            return None
        # Le diamètre arrive en flottant du fournisseur (16.0) : interpolé
        # tel quel, la ligne de panier affichait « 205/55 R16.0 ». Les
        # demi-pouces existent bien (15.5), donc on ne tronque pas — on
        # retire seulement le « .0 » des valeurs entières.
        d_txt = f"{d:g}" if isinstance(d, float) else str(d)
        return f"{w}/{r} R{d_txt}"

    items = [
        CartItemOut(
            id=i.id,
            supplier_ref=i.supplier_ref,
            label=i.label_snapshot,
            quantity=i.quantity,
            price_ht=i.price_ht_snapshot,
            price_ttc=i.price_ttc_snapshot,
            dimension=_dimension(i.product_data or {}),
            image_url=(i.product_data or {}).get("image_url"),
            season=(i.product_data or {}).get("season"),
            category=(i.product_data or {}).get("category", "auto"),
        )
        for i in cart.items
    ]
    total_ht = round(sum(i.price_ht * i.quantity for i in items), 2)
    total_ttc = round(sum(i.price_ttc * i.quantity for i in items), 2)

    # Frais de port : calculés ici (règles serveur) pour que le front
    # n'ait pas à dupliquer la logique « gratuit si toutes lignes >= 2 ».
    from app.modules.shipping.rules import compute_home_shipping
    if items:
        ship = compute_home_shipping(
            [(i.category, i.quantity) for i in items]
        )
        shipping_ht = ship.ht_cents / 100
        shipping_ttc = ship.ttc_cents / 100
    else:
        shipping_ht = shipping_ttc = 0.0

    return CartOut(
        id=cart.id,
        session_token=cart.session_token,
        items=items,
        total_ht=total_ht,
        total_ttc=total_ttc,
        shipping_ht=shipping_ht,
        shipping_ttc=shipping_ttc,
        free_shipping=bool(items) and shipping_ttc == 0,
        grand_total_ttc=round(total_ttc + shipping_ttc, 2),
    )


@router.post("/items", response_model=CartOut)
async def add_item(
    data: AddItemIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.add_item(
            db, user, x_cart_session,
            data.supplier_ref, data.width, data.ratio,
            data.diameter, data.quantity, data.category,
        )
    except service.StockError as e:
        # 409 et non 404 : la référence existe, c'est la quantité qui est
        # en conflit avec le stock. `available` permet au frontend de
        # proposer d'ajuster la quantité au lieu d'un cul-de-sac.
        raise HTTPException(
            status_code=409,
            detail={"message": str(e), "available": e.available, "already": e.already},
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _serialize(cart)


@router.get("", response_model=CartOut)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    if user is not None:
        cart = await db.scalar(
            select(Cart).where(Cart.user_id == user.id)
            .options(selectinload(Cart.items))
        )
    elif x_cart_session:
        cart = await db.scalar(
            select(Cart).where(Cart.session_token == x_cart_session)
            .options(selectinload(Cart.items))
        )
    else:
        cart = None
    if cart is None:
        return CartOut(id=None, session_token=None, items=[], total_ht=0, total_ttc=0)
    return _serialize(cart)


@router.patch("/items/{item_id}", response_model=CartOut)
async def update_item(
    item_id: str,
    data: UpdateQtyIn,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.update_item_quantity(
            db, user, x_cart_session, item_id, data.quantity
        )
    except service.StockError as e:
        raise HTTPException(
            status_code=409,
            detail={"message": str(e), "available": e.available, "already": e.already},
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _serialize(cart)


@router.delete("/items/{item_id}", response_model=CartOut)
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
    x_cart_session: str | None = Header(default=None),
):
    try:
        cart = await service.remove_item(
            db, user, x_cart_session, item_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return _serialize(cart)


@router.post("/merge", response_model=CartOut)
async def merge_cart(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    x_cart_session: str | None = Header(default=None),
):
    if x_cart_session:
        await service.merge_anonymous_cart(db, user, x_cart_session)
    cart = await db.scalar(
        select(Cart).where(Cart.user_id == user.id)
        .options(selectinload(Cart.items))
    )
    if cart is None:
        raise HTTPException(status_code=404, detail="Panier vide")
    return _serialize(cart)


@router.post("/promo/validate", response_model=PromoValidateOut)
async def validate_promo_code(
    data: PromoValidateIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aperçu de la remise d'un code promo sur le panier actuel.

    Purement informatif (UX) : le checkout re-valide de son côté.
    Renvoie toujours 200, avec valid=False + raison si refus."""
    cart = await db.scalar(
        select(Cart).where(Cart.user_id == user.id)
        .options(selectinload(Cart.items))
    )
    if cart is None or not cart.items:
        return PromoValidateOut(valid=False, reason="Panier vide")

    articles_ttc_cents = sum(
        round(i.price_ttc_snapshot * 100) * i.quantity for i in cart.items
    )
    from app.modules.promo.service import validate_promo
    try:
        promo, discount = await validate_promo(
            db, data.code, user.id, articles_ttc_cents
        )
    except ValueError as e:
        return PromoValidateOut(valid=False, reason=str(e))
    return PromoValidateOut(
        valid=True,
        code=promo.code,
        description=promo.description,
        discount_ttc=discount / 100,
    )


@router.post("/checkout", response_model=CheckoutResult)
async def checkout(
    data: CheckoutIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Finalise le panier en commande.
 
    - Exige acceptation explicite des CGV (obligation légale e-commerce FR).
    - Adresses (livraison + facturation) et mode passés au service, qui
      figera tout dans la commande créée. billing_address_id omis =
      facturation identique à la livraison.
    - Si les prix Maxityre ont changé depuis l'ajout au panier, on ne
      crée PAS la commande : on renvoie les écarts pour confirmation
      explicite côté frontend (anti-litige).
    """
    if user.role == UserRole.garage:
        raise HTTPException(
            status_code=403,
            detail=(
                "Les comptes partenaires ne peuvent pas passer commande. "
                "Utilisez votre espace partenaire."
            ),
        )
    if not data.accept_terms:
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les conditions générales de vente",
        )
    try:
        order, changes = await service.checkout(
            db, user, data.address_id, data.delivery_mode,
            promo_code=data.promo_code,
            billing_address_id=data.billing_address_id,
            garage_id=data.garage_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
 
    if order is None:
        # Prix modifiés : commande non créée, on renvoie les écarts
        return CheckoutResult(
            price_changes=[
                {
                    "supplier_ref": c.supplier_ref,
                    "label": c.label,
                    "old_ttc": c.old_ttc,
                    "new_ttc": c.new_ttc,
                }
                for c in changes
            ]
        )
    return CheckoutResult(
        order_number=order.order_number,
        status=order.status.value,
        total_ttc=order.total_ttc_cents / 100,
    )


def _price_changes_payload(changes) -> list[dict]:
    return [
        {
            "supplier_ref": c.supplier_ref,
            "label": c.label,
            "old_ttc": c.old_ttc,
            "new_ttc": c.new_ttc,
        }
        for c in changes
    ]


@router.post("/checkout/guest", response_model=GuestCheckoutResult)
async def checkout_guest(
    request: Request,
    data: GuestCheckoutIn,
    db: AsyncSession = Depends(get_db),
    x_cart_session: str | None = Header(default=None),
):
    """Commande sans inscription préalable.

    Le compte est créé en arrière-plan puis la commande passe par
    EXACTEMENT le même `service.checkout` que le parcours connecté :
    revalidation des prix contre le fournisseur, verrou sur le panier,
    machine à états. Aucune règle métier n'est dupliquée ici, et le
    chemin de l'argent reste unique.
    """
    # Cet endpoint crée un compte : sans limite, il sert de fabrique à
    # comptes et d'oracle pour savoir quelles adresses email sont déjà
    # enregistrées (le 409 les distingue).
    #
    # Calibrage 15/10 min — deux contraintes opposées :
    #   - le compteur incrémente à CHAQUE appel, échecs compris (code
    #     postal refusé, 409 « compte existant »...), et derrière un CGNAT
    #     mobile des dizaines de clients partagent une IP : à 5, on
    #     bloquait un acheteur légitime au moment où il sort sa carte ;
    #   - à 15, un abus reste plafonné à ~90 comptes/h/IP, assez de
    #     friction pour rendre la création industrielle inintéressante
    #     (l'oracle d'emails existe de toute façon via /auth/register).
    # Les 429 sont visibles dans les logs JSON : ajuster sur données
    # réelles si de vrais clients tapent la limite.
    await rate_limit(request, "guest_checkout", max_attempts=15, window_seconds=600)

    if not data.accept_terms:
        raise HTTPException(
            status_code=400,
            detail="Vous devez accepter les conditions générales de vente",
        )
    if not x_cart_session:
        raise HTTPException(status_code=400, detail="Panier introuvable")

    user = await auth_service.create_guest_user(
        db, data.email, data.first_name, data.last_name, data.phone
    )

    shipping = Address(user_id=user.id, **data.shipping.model_dump())
    db.add(shipping)
    billing = None
    if data.billing is not None:
        billing = Address(user_id=user.id, **data.billing.model_dump())
        db.add(billing)
    await db.flush()

    # Le panier de l'invité est porté par sa session : sans ce rattachement,
    # `service.checkout` chercherait un panier lié au compte tout juste créé
    # et n'en trouverait aucun.
    await service.merge_anonymous_cart(db, user, x_cart_session)

    try:
        order, changes = await service.checkout(
            db, user, shipping.id, data.delivery_mode,
            promo_code=data.promo_code,
            billing_address_id=billing.id if billing is not None else None,
            garage_id=data.garage_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if order is None:
        # Prix modifiés : commande non créée. On rend quand même les jetons,
        # sinon le client — dont le compte et le panier existent désormais —
        # se retrouverait déconnecté devant l'écran de confirmation des
        # écarts, sans moyen de valider.
        tokens = await auth_service.issue_token_pair(db, user, request)
        return GuestCheckoutResult(
            price_changes=_price_changes_payload(changes),
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
        )

    tokens = await auth_service.issue_token_pair(db, user, request)
    return GuestCheckoutResult(
        order_number=order.order_number,
        status=order.status.value,
        total_ttc=order.total_ttc_cents / 100,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )
