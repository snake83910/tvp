"""Stock déjà engagé par nos propres commandes.

LE PROBLÈME. Le stock affiché vient de Maxityre, en direct. Tant qu'on
ne lui a pas transmis une commande, il ignore qu'elle existe : son
compteur ne bouge pas. Le contrôle « quantité demandée <= stock
fournisseur » laissait donc passer autant de commandes qu'on voulait sur
la même dernière pièce — par des clients différents, ou par le même
client en deux commandes successives. Personne ne s'en apercevait avant
la transmission au fournisseur, c'est-à-dire après encaissement.

LA CORRECTION. On retranche du stock fournisseur ce que nos propres
commandes ont déjà engagé et qui ne lui a PAS encore été transmis.

Quels états comptent, et pourquoi seulement ceux-là :

  * `pending_payment` — engagé. Le client est sur la page bancaire ; lui
    prendre sa pièce pendant qu'il saisit sa carte serait absurde. La
    réservation se libère seule : le job de relance annule au bout de
    7 jours.
  * `paid` — engagé, évidemment.
  * `sent_to_supplier` et au-delà — PLUS compté. La commande est partie
    chez Maxityre, dont le stock la reflète désormais : la retrancher
    une seconde fois reviendrait à la décompter deux fois et à refuser
    des ventes possibles.
  * `cart` — jamais compté. Un panier n'est pas un engagement, il traîne
    parfois trois mois. Réserver dessus fermerait la boutique.

CE QUE ÇA NE RÉSOUT PAS. Maxityre vend aussi à d'autres. Sa dernière
pièce peut partir ailleurs entre notre commande et notre transmission —
aucun code de notre côté n'y changera rien. Ce module supprime la
survente dont NOUS sommes la cause ; le reste se traite au moment du
réapprovisionnement.
"""
from __future__ import annotations

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderItem, OrderStatus

#: Commandes qui immobilisent du stock chez nous sans que le fournisseur
#: le sache encore.
ENGAGED_STATUSES = (OrderStatus.pending_payment, OrderStatus.paid)


async def engaged(db: AsyncSession, supplier_ref: str) -> int:
    """Quantité de cette référence déjà promise à des clients."""
    total = await db.scalar(
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .where(
            OrderItem.supplier_ref == supplier_ref,
            Order.status.in_(ENGAGED_STATUSES),
        )
    )
    return int(total or 0)


async def available(
    db: AsyncSession, supplier_ref: str, supplier_stock: int | None
) -> int | None:
    """Stock réellement vendable. None quand le fournisseur ne le dit pas.

    None se propage volontairement : un stock inconnu ne doit pas être
    traité comme zéro, sinon une lacune du catalogue fournisseur
    fermerait la vente d'une référence disponible.
    """
    if supplier_stock is None:
        return None
    return max(0, supplier_stock - await engaged(db, supplier_ref))


async def lock(db: AsyncSession, supplier_ref: str) -> None:
    """Sérialise les commandes portant sur la même référence.

    Sans ce verrou, deux clients qui valident à la même seconde lisent
    tous les deux « 1 disponible, 0 engagé » et créent tous les deux leur
    commande : le contrôle ci-dessus ne sert alors à rien. Le verrou
    consultatif de PostgreSQL les met en file d'attente, le second
    recomptant après le commit du premier.

    `xact` : relâché automatiquement à la fin de la transaction, y
    compris sur erreur. Rien à libérer à la main, donc rien à oublier.

    Portée à la RÉFÉRENCE : deux commandes sur des pneus différents ne
    s'attendent pas. `hashtext` peut théoriquement produire une
    collision, dont le seul effet serait de faire patienter deux
    commandes sans rapport quelques millisecondes.
    """
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:ref))"),
        {"ref": supplier_ref},
    )
