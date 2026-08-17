"""Jobs cron-friendly, appelés depuis crontab via curl.

Sécurité : header X-Cron-Token comparé à settings.cron_token.
Si cron_token est vide, tous les endpoints renvoient 503 (désactivés).

Exemple crontab sur le VPS :
    # Relance commandes non payées, toutes les heures
    0 * * * * curl -sS -X POST -H "X-Cron-Token: $CRON_TOKEN" \\
        https://tousvospneus.com/api/cron/dunning >/dev/null
    # Rappels de rendez-vous, toutes les heures
    15 * * * * curl -sS -X POST -H "X-Cron-Token: $CRON_TOKEN" \\
        https://tousvospneus.com/api/cron/appointments >/dev/null
    # Sollicitation d'avis, une fois par jour
    30 10 * * * curl -sS -X POST -H "X-Cron-Token: $CRON_TOKEN" \\
        https://tousvospneus.com/api/cron/reviews >/dev/null
    # Purge des données périmées, une fois par jour en heure creuse
    45 4 * * * curl -sS -X POST -H "X-Cron-Token: $CRON_TOKEN" \\
        https://tousvospneus.com/api/cron/purge >/dev/null
"""
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.cron import CronRun
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter(prefix="/cron", tags=["cron"])


#: Période attendue de chaque job, en minutes. Sert à `/health` : un job
#: dont la dernière exécution remonte à plus de deux fois sa période est
#: considéré en panne. Toute entrée ajoutée ici devient surveillée.
JOB_PERIOD_MINUTES: dict[str, int] = {
    "dunning": 60,
    "appointments": 60,
    "reviews": 24 * 60,
    "product-reviews": 24 * 60,
    "purge": 24 * 60,
}


#: Corps des jobs, indexés par nom. Permet de les déclencher ailleurs
#: que depuis le crontab — l'administration en propose l'exécution
#: manuelle, utile pour vérifier un correctif sans attendre l'heure
#: suivante, ou pour rattraper une nuit sautée. Le suivi d'exécution est
#: le même : un lancement manuel se voit comme les autres.
def job_runners() -> dict:
    return {
        "dunning": _run_dunning,
        "appointments": _run_appointments,
        "reviews": _run_reviews,
        "product-reviews": _run_product_reviews,
        "purge": _run_purge,
    }


async def run_job(db: AsyncSession, job: str) -> dict:
    """Exécute un job par son nom, avec sa trace. Lève KeyError si inconnu."""
    runner = job_runners()[job]
    return await _tracked(db, job, lambda: runner(db))


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


async def _tracked(
    db: AsyncSession, job: str, work: Callable[[], Awaitable[dict]]
) -> dict:
    """Exécute un job en laissant une trace de son passage.

    Sans cette trace, un crontab perdu au redéploiement ou un
    `CRON_TOKEN` régénéré arrête les relances en silence : le premier
    signal serait un client qui se plaint. Une ligne par job, écrasée à
    chaque passage — on veut savoir si le job est vivant, pas conserver
    un journal.

    L'échec est enregistré AUSSI : un job qui lève chaque heure doit se
    voir autrement que par « dernière exécution il y a trois jours ».
    """
    started = datetime.now(UTC)
    try:
        detail = await work()
    except Exception as exc:
        # La session est probablement cassée : on repart propre avant
        # d'écrire la trace, sinon on perdrait l'information de l'échec
        # en plus de l'échec lui-même.
        await db.rollback()
        await _record_run(db, job, started, "error", {"error": str(exc)[:500]})
        raise
    await _record_run(db, job, started, "ok", detail)
    return detail


async def _record_run(
    db: AsyncSession, job: str, started: datetime, outcome: str, detail: dict
) -> None:
    finished = datetime.now(UTC)
    values = {
        "job": job,
        "started_at": started,
        "finished_at": finished,
        "status": outcome,
        "duration_ms": int((finished - started).total_seconds() * 1000),
        "detail": detail,
    }
    stmt = pg_insert(CronRun).values(**values)
    await db.execute(
        stmt.on_conflict_do_update(
            index_elements=[CronRun.job],
            set_={k: v for k, v in values.items() if k != "job"},
        )
    )
    await db.commit()


@router.post("/dunning")
async def dunning(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    return await _tracked(db, "dunning", lambda: _run_dunning(db))


async def _run_dunning(db: AsyncSession) -> dict:
    """Relance les commandes en attente de paiement.

    Trois passes, dans cet ordre — l'ordre EST la garantie :

    0. **Réconciliation bancaire.** On demande à la banque ce qu'elle a
       encaissé. Un IPN perdu (nginx qui redémarre, coupure réseau)
       laisse une commande payée en `pending_payment` : sans cette
       passe, la suite la relancerait puis l'annulerait, alors que le
       client est débité.
    1. **Abandon.** Au-delà de 7 jours, annulation — mais UNIQUEMENT si
       la banque a confirmé n'avoir rien encaissé. Une banque muette
       n'autorise rien : la commande reste en attente et remonte dans
       l'écran « à traiter » de l'admin.
    2. **Relance.** Email au bout d'1 h, puis une fois par 24 h.
    """
    from app.modules.mailer import get_mailer
    from app.modules.mailer.base import fire_and_forget
    from app.modules.mailer.service import send_order_cancelled
    from app.modules.orders import reconcile

    now = datetime.now(UTC)
    threshold_relance = now - timedelta(hours=1)
    threshold_abandon = now - timedelta(days=7)
    # Quinze minutes : au-delà, un paiement abouti dont l'IPN n'est pas
    # arrivé est une anomalie, pas un client encore sur la page bancaire.
    threshold_check = now - timedelta(minutes=15)

    # ── Passe 0 : ce que la banque, elle, a vu ──────────────────────
    to_check = (await db.scalars(
        select(Order).where(
            Order.status == OrderStatus.pending_payment,
            Order.created_at <= threshold_check,
        )
    )).all()
    recovered = 0
    for order in to_check:
        if await reconcile.reconcile_order(db, order) == reconcile.PAID:
            recovered += 1

    # Jointure User directe : évite un SELECT par commande (N+1). La
    # requête est REJOUÉE après la passe 0, qui a pu sortir des
    # commandes de `pending_payment`.
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
    # Commandes qu'on refuse d'annuler faute de réponse de la banque.
    blocked = 0
    mailer = get_mailer()
    for order, user in pending:

        if order.created_at <= threshold_abandon:
            if order.payment_check_result not in reconcile.SAFE_TO_CANCEL:
                # On ne sait pas si le client a payé. Annuler serait
                # parier son argent contre une ligne de statut.
                blocked += 1
                continue
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
        "bank_checked": len(to_check),
        "recovered": recovered,
        "relanced": relanced,
        "abandoned": abandoned,
        "blocked": blocked,
    }


@router.post("/appointments")
async def appointments(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    return await _tracked(db, "appointments", lambda: _run_appointments(db))


async def _run_appointments(db: AsyncSession) -> dict:
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


# Deux jours : le client a reçu ses pneus, il est passé au garage, et le
# souvenir est encore frais. Demander le jour même reviendrait à noter un
# montage qui n'a pas eu lieu.
REVIEW_DELAY_DAYS = 2


@router.post("/reviews")
async def reviews(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    return await _tracked(db, "reviews", lambda: _run_reviews(db))


@router.post("/product-reviews")
async def product_reviews(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    return await _tracked(
        db, "product-reviews", lambda: _run_product_reviews(db)
    )


async def _run_reviews(db: AsyncSession) -> dict:
    """Sollicite un avis sur le garage après une livraison.

    À lancer une fois par jour. Ne concerne que les commandes livrées
    chez un partenaire : l'avis porte sur le prestataire, il n'aurait
    aucun sens pour une livraison à domicile.

    Trois garde-fous, parce qu'un email d'avis mal ciblé est du spam :

    * une seule demande par commande (`review_requested_at`) ;
    * rien si le client a DÉJÀ noté ce garage — il ne pourrait pas
      publier un second avis, l'endpoint le refuserait en 409 ;
    * rien si la fiche garage a disparu depuis : le lien tomberait sur
      une 404.
    """
    from app.models.garage import Garage, GarageReview
    from app.modules.mailer.service import send_review_request

    now = datetime.now(UTC)
    threshold = now - timedelta(days=REVIEW_DELAY_DAYS)

    rows = (await db.execute(
        select(Order, User, Garage)
        .join(User, User.id == Order.user_id)
        .join(Garage, Garage.id == Order.garage_id)
        .where(
            Order.status == OrderStatus.delivered,
            Order.delivery_mode == "partner_garage",
            Order.review_requested_at.is_(None),
            Order.delivered_at.is_not(None),
            Order.delivered_at <= threshold,
        )
    )).all()

    sent = 0
    for order, user, garage in rows:
        already = await db.scalar(
            select(GarageReview.id).where(
                GarageReview.garage_id == garage.id,
                GarageReview.user_id == user.id,
            )
        )
        # L'horodatage est posé dans les deux cas : le client qui a déjà
        # noté ce garage n'a pas à être repêché au prochain passage.
        order.review_requested_at = now
        if already:
            continue
        send_review_request(order, user, garage.slug)
        sent += 1

    await db.commit()
    return {"checked": len(rows), "sent": sent}


async def _run_product_reviews(db: AsyncSession) -> dict:
    """Sollicite un avis sur les PNEUS, après n'importe quelle livraison.

    Job SÉPARÉ de `reviews`, qui porte sur le garage. Deux populations
    différentes — toutes les livraisons ici, les seuls montages chez un
    partenaire là-bas — donc deux requêtes, deux horodatages, et deux
    santés à surveiller indépendamment. Les fondre aurait fait un job
    dont « 3 envoyés » ne dit pas de quoi il parle.

    C'est celui-ci qui alimente les fiches produits, donc les étoiles
    dans les résultats Google.

    Deux garde-fous, mêmes raisons que pour l'avis garage : un
    horodatage dédié pour ne demander qu'une fois, et rien si le client
    a déjà noté cette commande — le formulaire le refuserait.
    """
    from app.models.catalog import ProductReview
    from app.modules.catalog import reviews as review_tokens
    from app.modules.mailer.service import send_product_review_request

    now = datetime.now(UTC)
    threshold = now - timedelta(days=REVIEW_DELAY_DAYS)

    rows = (await db.execute(
        select(Order, User)
        .join(User, User.id == Order.user_id)
        .where(
            Order.status == OrderStatus.delivered,
            Order.product_review_requested_at.is_(None),
            Order.delivered_at.is_not(None),
            Order.delivered_at <= threshold,
        )
    )).all()

    sent = 0
    for order, user in rows:
        order.product_review_requested_at = now
        already = await db.scalar(
            select(ProductReview.id).where(ProductReview.order_id == order.id)
        )
        if already:
            continue
        send_product_review_request(
            order, user, review_tokens.create_token(str(order.id))
        )
        sent += 1

    await db.commit()
    return {"checked": len(rows), "sent": sent}


# ── Purge des données périmées ─────────────────────────────────────
#
# Trois tables grossissaient sans fin : une ligne de `login_logs` par
# tentative de connexion, un `refresh_tokens` par session, un panier par
# visiteur anonyme. Sur une base de développement, `login_logs` était
# déjà la plus grosse table du site — devant les commandes.
#
# Le sujet dépasse l'hygiène : `login_logs` conserve des ADRESSES IP, et
# les garder sans limite de durée contrevient au principe de
# minimisation. La CNIL attend une durée définie sur les journaux de
# connexion. Six mois est une valeur défendable pour un site marchand ;
# c'est une décision à faire valider, d'où la constante isolée et
# nommée plutôt qu'un littéral perdu dans une requête.

#: Journaux de connexion (IP, user-agent). Durée à valider juridiquement.
LOGIN_LOG_RETENTION_DAYS = 180

#: Jetons expirés ou révoqués. Le délai de grâce laisse de quoi enquêter
#: sur un incident récent avant que la trace ne disparaisse.
REFRESH_TOKEN_GRACE_DAYS = 30

#: Paniers ANONYMES sans activité. Les paniers rattachés à un compte
#: sont épargnés : ils sont bornés par le nombre de clients, et en
#: supprimer un se verrait côté client.
ANONYMOUS_CART_DAYS = 90

#: Plafond par table et par passage. La première exécution après des
#: mois d'accumulation pourrait supprimer des centaines de milliers de
#: lignes d'un coup et bloquer la table le temps de la transaction. Le
#: job tourne tous les jours : le retard se résorbe en quelques
#: passages, sans jamais immobiliser la base.
PURGE_BATCH = 20_000


@router.post("/purge")
async def purge(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(_require_cron_token),
):
    return await _tracked(db, "purge", lambda: _run_purge(db))


async def _run_purge(db: AsyncSession) -> dict:
    """Supprime les données périmées. À lancer une fois par jour.

    Chaque suppression est bornée (`PURGE_BATCH`) : mieux vaut plusieurs
    passages qu'une transaction qui immobilise une table de production.
    """
    from sqlalchemy import delete

    from app.models.order import Cart
    from app.models.security import LoginLog, RefreshToken

    now = datetime.now(UTC)

    async def _bounded_delete(model, condition) -> int:
        """DELETE ... WHERE id IN (SELECT id ... LIMIT n).

        SQLAlchemy ne sait pas poser de LIMIT sur un DELETE : on passe
        par une sous-requête sur la clé primaire.
        """
        ids = (await db.scalars(
            select(model.id).where(condition).limit(PURGE_BATCH)
        )).all()
        if not ids:
            return 0
        await db.execute(delete(model).where(model.id.in_(ids)))
        return len(ids)

    logs = await _bounded_delete(
        LoginLog,
        LoginLog.created_at < now - timedelta(days=LOGIN_LOG_RETENTION_DAYS),
    )

    # Expiré OU révoqué depuis assez longtemps. Un jeton révoqué mais non
    # encore expiré doit rester le temps du délai de grâce : c'est
    # justement celui qui intéresse une enquête.
    grace = now - timedelta(days=REFRESH_TOKEN_GRACE_DAYS)
    tokens = await _bounded_delete(
        RefreshToken,
        or_(
            RefreshToken.expires_at < grace,
            and_(
                RefreshToken.revoked_at.is_not(None),
                RefreshToken.revoked_at < grace,
            ),
        ),
    )

    # `cart_items` suit par ON DELETE CASCADE (vérifié en base).
    carts = await _bounded_delete(
        Cart,
        and_(
            Cart.user_id.is_(None),
            Cart.updated_at < now - timedelta(days=ANONYMOUS_CART_DAYS),
        ),
    )

    await db.commit()
    return {
        "login_logs": logs,
        "refresh_tokens": tokens,
        "anonymous_carts": carts,
        "batch_limit": PURGE_BATCH,
    }
