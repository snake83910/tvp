"""Transmission d'une commande au panier du fournisseur.

Chaque commande payée était ressaisie à la main sur le site Maxityre :
le poste le plus coûteux par commande, celui qui plafonne le volume, et
celui où une faute de frappe envoie les mauvais pneus.

On s'arrête au PANIER, délibérément. `cart/add` n'achète rien : un
humain ouvre ensuite le panier Maxityre, vérifie et valide. La ressaisie
disparaît, le contrôle avant dépense reste — et un bug ici ne peut pas
commander mille pneus.

Trois décisions structurent le module.

**Les offres sont relues au moment de la transmission.** Entre la vente
au client et l'envoi au fournisseur, il peut s'écouler des jours : une
offre disparaît, change de prix ou de délai. Un `offerId` mémorisé au
catalogue désignerait ce qui n'existe plus.

**Le délai promis au client pèse dans le choix.** À stock suffisant, on
préfère l'offre la moins chère qui tient la date annoncée. Aucune ne la
tient ? On prend la plus rapide ET on le signale : les rendez-vous de
montage sont calculés sur cette date, la faire glisser en silence
enverrait un client devant un pont vide.

**Rien n'est marqué transmis sans réponse du fournisseur.** Même règle
que pour les remboursements : un état qui ment coûte plus cher qu'une
erreur affichée.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem


class SupplierCartError(RuntimeError):
    """Rien n'a été ajouté. La commande n'a pas bougé."""


def _delivery_date(offer: dict) -> date | None:
    raw = offer.get("dateDelivery")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw)).date()
    except ValueError:
        return None


def pick_offer(
    offers: list[dict], quantity: int, promised: date | None = None
) -> tuple[dict | None, bool]:
    """Meilleure offre pour cette quantité, et si le délai promis glisse.

    Rend `(offre, retard)`. `offre` est None si aucune n'a le stock.

    Le tri privilégie le prix, mais seulement parmi celles qui tiennent
    la date annoncée au client. Économiser deux euros en livrant trois
    jours plus tard n'est pas une économie quand un rendez-vous de
    montage est calé dessus.
    """
    disponibles = [
        o for o in offers
        if int(o.get("stock") or 0) >= quantity
        and o.get("offerId") and o.get("hash")
    ]
    if not disponibles:
        return None, False

    def cout(o: dict) -> float:
        # `supHtOne` est un supplément unitaire : l'ignorer ferait
        # passer pour moins chère une offre qui ne l'est pas.
        return float(o.get("prixHt") or 0) + float(o.get("supHtOne") or 0)

    a_temps = [
        o for o in disponibles
        if promised is None
        or (_delivery_date(o) or date.max) <= promised
    ]
    if a_temps:
        return min(a_temps, key=cout), False

    # Personne ne tient la date : on prend la plus rapide, et on le dit.
    return min(disponibles, key=lambda o: _delivery_date(o) or date.max), True


async def build_lines(
    connector, order: Order, items: list[OrderItem]
) -> tuple[list[dict], list[dict]]:
    """Compose les lignes de panier, et le compte rendu par article.

    Le compte rendu est rendu à l'admin : il porte le prix d'achat du
    jour et les articles introuvables. Une transmission qui « marche »
    sans dire à quel prix on achète ne sert à rien — la marge se vérifie
    à ce moment-là, pas au relevé bancaire.
    """
    lines: list[dict] = []
    rapport: list[dict] = []

    for item in items:
        try:
            offers = await connector.get_offers(item.supplier_ref)
        except Exception as exc:
            rapport.append({
                "ref": item.supplier_ref,
                "label": item.label_snapshot,
                "ok": False,
                "error": f"{type(exc).__name__}: {str(exc)[:120]}",
            })
            continue

        offer, retard = pick_offer(offers, item.quantity, order.delivery_estimate)
        if offer is None:
            rapport.append({
                "ref": item.supplier_ref,
                "label": item.label_snapshot,
                "ok": False,
                "error": f"Aucune offre avec {item.quantity} en stock",
            })
            continue

        lines.append({
            "supplier": offer.get("supplierId"),
            "hash": offer.get("hash"),
            "productId": int(item.supplier_ref),
            "type": "tyre",
            "quantity": item.quantity,
            "offerId": offer.get("offerId"),
        })
        achat = float(offer.get("prixHt") or 0)
        rapport.append({
            "ref": item.supplier_ref,
            "label": item.label_snapshot,
            "ok": True,
            "quantity": item.quantity,
            # Prix d'ACHAT du jour, à comparer au prix de vente figé.
            "buy_price_ht": achat,
            "sell_price_ht": item.unit_price_ht_cents / 100,
            "delivery": offer.get("dateDelivery"),
            # Le délai promis au client n'est pas tenu par cette offre.
            "late": retard,
        })

    return lines, rapport


async def push_order(db: AsyncSession, order: Order) -> dict:
    """Ajoute les articles d'une commande au panier Maxityre.

    Lève `SupplierCartError` si rien n'a pu être ajouté — la commande
    reste alors intacte, et l'admin voit pourquoi.
    """
    from app.core.config import settings

    if settings.supplier_provider != "maxityre":
        raise SupplierCartError(
            "Transmission indisponible : le catalogue n'est pas branché "
            "sur Maxityre sur cette instance."
        )

    items = (await db.scalars(
        select(OrderItem).where(OrderItem.order_id == order.id)
    )).all()
    if not items:
        raise SupplierCartError("Commande sans article.")

    from app.integrations.maxityre import MaxityreConnector

    connector = MaxityreConnector()
    lines, rapport = await build_lines(connector, order, items)
    if not lines:
        raise SupplierCartError(
            "Aucun article n'a pu être trouvé chez le fournisseur : "
            + " · ".join(r.get("error", "") for r in rapport if not r["ok"])
        )

    try:
        answer = await connector.add_to_cart(lines)
    except Exception as exc:
        raise SupplierCartError(
            f"Le fournisseur a refusé l'ajout : {type(exc).__name__} "
            f"{str(exc)[:200]}"
        ) from exc

    cart = answer.get("cart") or {}
    result = {
        "lines": rapport,
        "cart_id": cart.get("id"),
        "cart_count": cart.get("countProducts"),
        # Total d'achat du jour : la marge se lit ici.
        "buy_total_ht": round(
            sum(
                r["buy_price_ht"] * r["quantity"]
                for r in rapport
                if r.get("ok")
            ),
            2,
        ),
        "partial": any(not r["ok"] for r in rapport),
        "late": any(r.get("late") for r in rapport),
        "pushed_at": datetime.now(UTC).isoformat(),
    }

    order.supplier_pushed_at = datetime.now(UTC)
    order.supplier_push_result = result
    return result
