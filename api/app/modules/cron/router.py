"""Jobs cron-friendly, appelés depuis crontab via curl.

Sécurité : header X-Cron-Token comparé à settings.cron_token.
Si cron_token est vide, tous les endpoints renvoient 503 (désactivés).

Exemple crontab sur le VPS :
    # Relance commandes non payées toutes les heures
    0 * * * * curl -sS -X POST -H "X-Cron-Token: $CRON_TOKEN" \\
        https://tousvospneus.com/api/cron/dunning >/dev/null
"""
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter(prefix="/cron", tags=["cron"])


def _require_cron_token(x_cron_token: str | None = Header(default=None)) -> None:
    if not settings.cron_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Jobs cron désactivés (CRON_TOKEN non configuré)",
        )
    # compare_digest : comparaison en temps constant (pas d'attaque timing)
    import hmac
    if not hmac.compare_digest(x_cron_token or "", settings.cron_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Cron-Token invalide",
        )


@router.post("/dunning")
async def dunning(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    """Relance les commandes en attente de paiement.

    - 1ère relance : commandes créées il y a 1h et toujours pending_payment
    - Abandon : commandes > 7j en pending_payment passent en cancelled
    """
    from app.modules.mailer import get_mailer
    from app.modules.mailer.base import fire_and_forget
    from app.modules.mailer.service import send_order_cancelled

    now = datetime.now(UTC)
    threshold_relance = now - timedelta(hours=1)
    threshold_abandon = now - timedelta(days=7)

    # Jointure User directe : évite un SELECT par commande (N+1)
    pending = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(
            Order.status == OrderStatus.pending_payment,
            Order.created_at <= threshold_relance,
        )
    )).all()

    relanced = 0
    abandoned = 0
    mailer = get_mailer()
    for order, user in pending:

        if order.created_at <= threshold_abandon:
            # Plus de 7 jours sans paiement -> annulation
            try:
                order.transition_to(OrderStatus.cancelled)
                send_order_cancelled(order, user, "Délai de paiement dépassé")
                abandoned += 1
            except Exception:
                pass
        elif order.last_dunning_at is None or order.last_dunning_at < now - timedelta(hours=24):
            # Relance : email simple
            fire_and_forget(
                mailer.send_template(
                    to=user.email,
                    subject=f"Votre commande {order.order_number} attend votre paiement",
                    template="order_dunning.html",
                    civilite=f"Bonjour {user.first_name}" if user.first_name else "Bonjour",
                    site_url=settings.public_site_url,
                    order_number=order.order_number,
                    payment_url=f"{settings.public_site_url}/paiement/{order.order_number}",
                )
            )
            order.last_dunning_at = now
            relanced += 1

    await db.commit()
    return {
        "checked": len(pending),
        "relanced": relanced,
        "abandoned": abandoned,
    }


@router.post("/appointments")
async def appointments(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    """Relances liées aux rendez-vous de montage.

    Deux passes, à lancer une fois par heure :

    1. **Rappel J-1** — le client reçoit un rappel la veille du montage.
       Le no-show est le premier coût d'un planning en ligne : un pont
       réservé et personne devant, c'est un créneau perdu pour tout le
       monde.

    2. **Rendez-vous à risque** — le créneau approche mais la commande
       n'est toujours pas expédiée : les pneus ont peu de chances d'être
       au garage à temps. On prévient le client AVANT qu'il se déplace,
       avec un lien pour décaler lui-même.

    Chaque commande n'est relancée qu'une fois par créneau : les
    horodatages sont remis à NULL quand le rendez-vous change.
    """
    from app.modules.garage.booking import PARIS
    from app.modules.mailer.service import (
        send_appointment_at_risk,
        send_appointment_reminder,
    )

    now = datetime.now(UTC)
    today_local = now.astimezone(PARIS).date()

    # Rappel : rendez-vous entre maintenant et dans 48 h. La fenêtre est
    # large exprès — le job tourne toutes les heures, et un rendez-vous à
    # 8 h du matin doit être rappelé la veille, pas à 7 h le jour même.
    reminder_horizon = now + timedelta(hours=48)
    # À risque : le créneau tombe dans les 3 jours et rien n'est parti.
    risk_horizon = now + timedelta(days=3)

    rows = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(
            Order.mounting_at.is_not(None),
            Order.mounting_at > now,
            Order.mounting_at <= risk_horizon,
            Order.status.in_(
                [
                    OrderStatus.paid,
                    OrderStatus.sent_to_supplier,
                    OrderStatus.shipped,
                ]
            ),
        )
    )).all()

    reminded = 0
    at_risk = 0
    for order, user in rows:
        local_day = order.mounting_at.astimezone(PARIS).date()

        # 1) Pneus pas encore expédiés à quelques jours du montage.
        if (
            order.status != OrderStatus.shipped
            and order.appointment_risk_notified_at is None
            and local_day > today_local
        ):
            send_appointment_at_risk(order, user)
            order.appointment_risk_notified_at = now
            at_risk += 1

        # 2) Rappel de la veille. Envoyé même si le colis n'est pas parti :
        #    le client a alors déjà reçu l'alerte ci-dessus et décide.
        if (
            order.mounting_at <= reminder_horizon
            and order.appointment_reminded_at is None
            and local_day <= today_local + timedelta(days=1)
        ):
            send_appointment_reminder(order, user)
            order.appointment_reminded_at = now
            reminded += 1

    await db.commit()
    return {"checked": len(rows), "reminded": reminded, "at_risk": at_risk}
