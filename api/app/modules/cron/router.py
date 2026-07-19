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
