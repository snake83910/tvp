"""Suivi de commande sans connexion.

Un client invité repart avec un compte dont il ignore l'existence et un
mot de passe qu'il n'a jamais choisi. Trois jours plus tard il veut
savoir où est son colis : le seul chemin était « mot de passe oublié »,
c'est-à-dire un email, un lien, un formulaire et un mot de passe à
inventer — pour lire une ligne d'état. La plupart écrivent au service
client à la place.

Deux informations suffisent : le numéro de commande, qui est sur son
email de confirmation, et son adresse email.

SÉCURITÉ. Les numéros de commande se suivent (CMD-2026-000001, 000002…) :
ils sont devinables, et ne prouvent rien. C'est l'EMAIL qui authentifie,
et le couple des deux qui ouvre. D'où trois précautions :

  * la réponse est la MÊME qu'un numéro soit inconnu ou que l'email ne
    corresponde pas — sinon l'endpoint dirait quelles commandes
    existent, et pour un numéro donné on pourrait tester des adresses
    jusqu'à trouver celle de l'acheteur ;
  * un plafond serré par IP, parce que la seule attaque réaliste est
    d'essayer beaucoup d'adresses sur un numéro connu ;
  * une vue RESTREINTE. Pas d'adresse postale, pas de nom, pas de
    montant détaillé : l'état d'avancement et le suivi transporteur, ce
    pour quoi on est venu. Le reste demande de se connecter.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, ErrorCode
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderTrackingIn, OrderTrackingOut

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/track", response_model=OrderTrackingOut)
async def track_order(
    data: OrderTrackingIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """État d'une commande, sur numéro + email."""
    # 10 par quart d'heure : de quoi se tromper de casse ou d'adresse
    # plusieurs fois, très loin de ce qu'exige une énumération.
    await rate_limit(request, "order_track", max_attempts=10, window_seconds=900)

    order = await db.scalar(
        select(Order)
        .join(User, User.id == Order.user_id)
        .where(
            Order.order_number == data.order_number.strip().upper(),
            # Comparaison en minuscules des DEUX côtés : les emails sont
            # normalisés à l'inscription, mais un compte importé ou créé
            # avant cette règle pourrait porter des majuscules.
            func.lower(User.email) == data.email,
        )
        .options(selectinload(Order.items))
    )

    if order is None:
        # Message unique, volontairement muet sur laquelle des deux
        # valeurs est en cause.
        raise AppError(
            status_code=404,
            code=ErrorCode.NOT_FOUND,
            message=(
                "Aucune commande ne correspond à ce numéro et à cette "
                "adresse email. Vérifiez votre email de confirmation."
            ),
        )

    return OrderTrackingOut(
        order_number=order.order_number,
        status=order.status.value,
        created_at=order.created_at,
        paid_at=order.paid_at,
        delivery_mode=order.delivery_mode or "home",
        total_ttc=order.total_ttc_cents / 100,
        item_count=sum(i.quantity for i in order.items),
        items=[i.label_snapshot for i in order.items],
        tracking_number=order.tracking_number,
        carrier=order.carrier,
        tracking_url=order.tracking_url,
        # Ville seule pour le montage : de quoi reconnaître son garage
        # sans exposer l'adresse complète de qui que ce soit.
        garage_name=(order.garage_snapshot or {}).get("name"),
        garage_city=(order.garage_snapshot or {}).get("city"),
    )
