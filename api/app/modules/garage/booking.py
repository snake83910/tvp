"""Créneaux de montage : génération, disponibilité, réservation.

Les créneaux ne sont jamais ressaisis par le garage : ils sont dérivés de
ses horaires d'ouverture (`Garage.hours`), amputés de ses périodes de
fermeture (`Garage.closures`), découpés selon `slot_minutes` et limités à
`slot_capacity` véhicules simultanés.

Règle métier centrale : on ne propose jamais un rendez-vous avant que les
pneus soient arrivés au garage. La date au plus tôt est donc calculée
depuis la livraison estimée du panier, plus `appointment_lead_days`
(1 par défaut, soit J+1). Ce calcul est fait ICI, côté serveur, et sert
à la fois à lister les créneaux et à valider la réservation au checkout :
un client qui forgerait une date antérieure est refusé.
"""
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.models.garage import Garage, GarageSlotBlock
from app.models.order import CartItem, Order, OrderStatus

# Le réseau de garages est français : les horaires saisis ("08:00") sont
# des heures locales, pas UTC.
PARIS = ZoneInfo("Europe/Paris")

# Clés de jour utilisées dans Garage.hours, indexées sur date.weekday().
WEEKDAY_KEYS = (
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
)

# Délai de transport retenu quand le fournisseur ne renvoie pas de date de
# livraison estimée. Volontairement prudent : mieux vaut proposer un
# rendez-vous un peu tard que faire venir le client avant ses pneus.
DEFAULT_TRANSIT_DAYS = 3

# Horizon de réservation proposé au client.
MAX_HORIZON_DAYS = 60

# Statuts pour lesquels un créneau reste occupé. Une commande annulée ou
# remboursée libère sa place.
_ACTIVE_STATUSES = (
    OrderStatus.pending_payment,
    OrderStatus.paid,
    OrderStatus.sent_to_supplier,
    OrderStatus.shipped,
    OrderStatus.delivered,
)


class BookingError(ValueError):
    """Créneau refusé (fermé, complet, trop tôt, RDV désactivés).

    Porte un `code` (voir `ErrorCode`) : c'est lui qui permet au client de
    réagir — recharger la liste des créneaux quand celui visé vient
    d'être pris, plutôt que de se contenter d'afficher un message.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _parse_hhmm(value: object) -> time | None:
    if not isinstance(value, str) or ":" not in value:
        return None
    try:
        h, m = value.split(":")[:2]
        return time(int(h), int(m))
    except ValueError:
        return None


def _parse_day(value: object) -> date | None:
    """Parse une date ISO tolérante : « 2026-08-19 » ou datetime ISO."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or len(value) < 10:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def day_ranges(hours: dict | None, d: date) -> list[tuple[time, time]]:
    """Plages d'ouverture d'un jour. Liste vide = fermé ce jour-là.

    Une pause déjeuner (`break_start`/`break_end`) coupe la journée en
    deux plages : sans ça, on proposerait des rendez-vous à 12h30 dans un
    garage rideau baissé.
    """
    cfg = (hours or {}).get(WEEKDAY_KEYS[d.weekday()])
    if not isinstance(cfg, dict) or cfg.get("closed"):
        return []
    opens, closes = _parse_hhmm(cfg.get("open")), _parse_hhmm(cfg.get("close"))
    if opens is None or closes is None or closes <= opens:
        return []
    bs, be = _parse_hhmm(cfg.get("break_start")), _parse_hhmm(cfg.get("break_end"))
    if bs and be and opens < bs < be < closes:
        return [(opens, bs), (be, closes)]
    return [(opens, closes)]


def is_closed_period(closures: list | None, d: date) -> str | None:
    """Motif de fermeture si `d` tombe dans un congé, sinon None."""
    for c in closures or []:
        if not isinstance(c, dict):
            continue
        start, end = _parse_day(c.get("start")), _parse_day(c.get("end"))
        if start and end and start <= d <= end:
            return (c.get("label") or "Fermeture").strip() or "Fermeture"
    return None


def day_slot_starts(garage: Garage, d: date) -> list[datetime]:
    """Débuts de créneaux d'une journée, en heure locale (aware)."""
    if is_closed_period(garage.closures, d):
        return []
    step = timedelta(minutes=max(5, garage.slot_minutes or 30))
    out: list[datetime] = []
    for opens, closes in day_ranges(garage.hours, d):
        cursor = datetime.combine(d, opens, tzinfo=PARIS)
        limit = datetime.combine(d, closes, tzinfo=PARIS)
        # Le dernier créneau doit tenir entièrement avant la fermeture.
        while cursor + step <= limit:
            out.append(cursor)
            cursor += step
    return out


def delivery_estimate_date(items: list[CartItem]) -> date | None:
    """Date de livraison estimée du panier : la plus tardive des lignes.

    Une commande part en un seul envoi : c'est l'article le plus lent qui
    détermine la date d'arrivée au garage.
    """
    dates = [
        d
        for it in items
        if (d := _parse_day((it.product_data or {}).get("delivery_estimate")))
    ]
    return max(dates) if dates else None


def earliest_mounting_date(
    garage: Garage,
    estimate: date | None,
    today: date | None = None,
    already_delivered: bool = False,
) -> date:
    """Première date de rendez-vous acceptable.

    `already_delivered` : les pneus sont physiquement au garage (commande
    expédiée ou livrée). Le délai après livraison n'a plus lieu d'être —
    seul reste le minimum de politesse d'un jour.
    """
    today = today or datetime.now(PARIS).date()
    if already_delivered:
        return today + timedelta(days=1)
    base = estimate
    if base is None or base < today:
        # Pas d'estimation fournisseur (ou estimation périmée) : on repart
        # d'aujourd'hui + un délai de transport prudent.
        base = today + timedelta(days=DEFAULT_TRANSIT_DAYS)
    lead = max(1, garage.appointment_lead_days or 1)
    return base + timedelta(days=lead)


async def _booked_counts(
    db: AsyncSession,
    garage_id: uuid.UUID,
    start: datetime,
    end: datetime,
    exclude_order_id: uuid.UUID | None = None,
) -> dict[datetime, int]:
    """Nombre de véhicules déjà réservés par créneau, sur une fenêtre."""
    stmt = select(Order.mounting_at).where(
        Order.garage_id == garage_id,
        Order.mounting_at.is_not(None),
        Order.mounting_at >= start,
        Order.mounting_at < end,
        Order.status.in_(_ACTIVE_STATUSES),
    )
    if exclude_order_id is not None:
        stmt = stmt.where(Order.id != exclude_order_id)
    rows = await db.scalars(stmt)
    counts: dict[datetime, int] = {}
    for at in rows:
        # Les datetimes remontent en UTC : on les ramène en heure locale
        # pour qu'ils coïncident avec les créneaux générés.
        key = at.astimezone(PARIS)
        counts[key] = counts.get(key, 0) + 1
    return counts


async def _blocks(
    db: AsyncSession, garage_id: uuid.UUID, start: datetime, end: datetime
) -> list[tuple[datetime, datetime]]:
    """Plages bloquées à la main par le garage, sur une fenêtre."""
    rows = await db.scalars(
        select(GarageSlotBlock).where(
            GarageSlotBlock.garage_id == garage_id,
            GarageSlotBlock.ends_at > start,
            GarageSlotBlock.starts_at < end,
        )
    )
    return [(b.starts_at, b.ends_at) for b in rows]


def _is_blocked(
    slot: datetime, duration: timedelta, blocks: list[tuple[datetime, datetime]]
) -> bool:
    """Le créneau chevauche-t-il une plage bloquée ?"""
    slot_end = slot + duration
    return any(start < slot_end and slot < end for start, end in blocks)


async def availability(
    db: AsyncSession,
    garage: Garage,
    estimate: date | None,
    days: int = 21,
    already_delivered: bool = False,
) -> dict:
    """Créneaux proposables au client, jour par jour."""
    first = earliest_mounting_date(
        garage, estimate, already_delivered=already_delivered
    )
    span = max(1, min(days, MAX_HORIZON_DAYS))
    last = first + timedelta(days=span)
    window_start = datetime.combine(first, time.min, tzinfo=PARIS)
    window_end = datetime.combine(last, time.min, tzinfo=PARIS)

    counts = await _booked_counts(db, garage.id, window_start, window_end)
    blocks = await _blocks(db, garage.id, window_start, window_end)
    capacity = max(1, garage.slot_capacity or 1)
    duration = timedelta(minutes=max(5, garage.slot_minutes or 30))

    out_days: list[dict] = []
    # Garage sans prise de RDV : on renvoie la structure (le front sait
    # ainsi que le garage existe) mais aucun créneau — proposer des heures
    # qu'aucune réservation n'accepterait serait un piège à clic.
    for i in range(span if garage.appointments_enabled else 0):
        d = first + timedelta(days=i)
        closure = is_closed_period(garage.closures, d)
        slots = [
            {
                "start": s.isoformat(),
                "available": (
                    counts.get(s, 0) < capacity
                    and not _is_blocked(s, duration, blocks)
                ),
            }
            for s in day_slot_starts(garage, d)
        ]
        out_days.append(
            {
                "date": d.isoformat(),
                "closure_label": closure,
                "slots": slots,
            }
        )

    return {
        "enabled": bool(garage.appointments_enabled),
        "delivery_estimate": estimate.isoformat() if estimate else None,
        "earliest_date": first.isoformat(),
        "slot_minutes": max(5, garage.slot_minutes or 30),
        "days": out_days,
    }


async def reserve_slot(
    db: AsyncSession,
    garage: Garage,
    estimate: date | None,
    mounting_at: str | datetime,
    already_delivered: bool = False,
    exclude_order_id: uuid.UUID | None = None,
) -> datetime:
    """Valide un créneau demandé au checkout et le renvoie normalisé.

    Lève `BookingError` si le garage ne prend pas de rendez-vous, si la
    date est antérieure au minimum, si elle ne correspond pas à un créneau
    réel, ou si le créneau est complet.
    """
    if not garage.appointments_enabled:
        raise BookingError(
            ErrorCode.APPOINTMENTS_DISABLED,
            "Ce garage ne propose pas la prise de rendez-vous en ligne",
        )

    if isinstance(mounting_at, str):
        try:
            requested = datetime.fromisoformat(mounting_at)
        except ValueError as e:
            raise BookingError(
                ErrorCode.VALIDATION_ERROR, "Date de rendez-vous invalide"
            ) from e
    else:
        requested = mounting_at
    # Une saisie sans fuseau est de l'heure locale du garage.
    requested = (
        requested.replace(tzinfo=PARIS)
        if requested.tzinfo is None
        else requested.astimezone(PARIS)
    )

    d = requested.date()
    if d < earliest_mounting_date(
        garage, estimate, already_delivered=already_delivered
    ):
        raise BookingError(
            ErrorCode.SLOT_TOO_EARLY,
            "Ce créneau est trop tôt : le montage ne peut pas être planifié "
            "avant la livraison des pneus au garage",
        )
    if requested not in day_slot_starts(garage, d):
        raise BookingError(
            ErrorCode.SLOT_NOT_OFFERED, "Ce créneau n'est pas proposé par le garage"
        )

    duration = timedelta(minutes=max(5, garage.slot_minutes or 30))

    # Verrou transactionnel par garage : sans lui, deux checkouts
    # simultanés comptent tous les deux « une place restante » et
    # surréservent le dernier créneau. Le verrou est relâché au commit.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"garage-slots:{garage.id}"},
    )
    if _is_blocked(
        requested, duration, await _blocks(db, garage.id, requested, requested + duration)
    ):
        raise BookingError(
            ErrorCode.SLOT_TAKEN, "Ce créneau n'est plus disponible. Choisissez-en un autre."
        )

    counts = await _booked_counts(
        db,
        garage.id,
        requested,
        requested + timedelta(microseconds=1),
        # Déplacer un rendez-vous vers le créneau qu'il occupe déjà ne doit
        # pas se heurter à sa propre réservation.
        exclude_order_id=exclude_order_id,
    )
    if counts.get(requested, 0) >= max(1, garage.slot_capacity or 1):
        raise BookingError(
            ErrorCode.SLOT_TAKEN, "Ce créneau vient d'être réservé. Choisissez-en un autre."
        )

    return requested.astimezone(UTC)
