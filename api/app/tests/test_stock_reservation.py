"""
Survente : le stock déjà engagé par nos propres commandes.

LE DÉFAUT CORRIGÉ ICI. Le stock vient de Maxityre, en direct. Tant qu'on
ne lui a pas transmis une commande, son compteur ne bouge pas. Le
contrôle « quantité demandée <= stock fournisseur » laissait donc passer
autant de commandes qu'on voulait sur la même dernière pièce — par des
clients différents ou par le même en deux fois. Constaté en base : cinq
commandes en cours sur une référence dont le fournisseur annonçait UNE
pièce.

Ce fichier verrouille les deux décisions qui font tenir la correction :
quels états immobilisent du stock, et ce qu'on fait quand le fournisseur
ne le déclare pas.

Lancer : pytest app/tests/test_stock_reservation.py
"""
from unittest.mock import AsyncMock, MagicMock

from app.models.order import OrderStatus
from app.modules.cart import reservation


def _db() -> MagicMock:
    return MagicMock()


async def test_stock_engage_retranche_du_disponible(monkeypatch):
    """Le fournisseur en annonce 3, deux sont déjà promis : il en reste
    un à vendre, pas trois."""
    monkeypatch.setattr(reservation, "engaged", AsyncMock(return_value=2))
    assert await reservation.available(_db(), "REF", 3) == 1


async def test_jamais_negatif(monkeypatch):
    """Cas réellement rencontré : cinq commandes en cours sur une seule
    pièce annoncée. Un disponible négatif se propagerait dans les
    messages affichés au client (« il reste -4 pneus »)."""
    monkeypatch.setattr(reservation, "engaged", AsyncMock(return_value=5))
    assert await reservation.available(_db(), "REF", 1) == 0


async def test_stock_inconnu_reste_inconnu(monkeypatch):
    """None se propage, et ne devient JAMAIS zéro : une lacune du
    catalogue fournisseur fermerait sinon la vente d'une référence
    parfaitement disponible."""
    monkeypatch.setattr(reservation, "engaged", AsyncMock(return_value=3))
    assert await reservation.available(_db(), "REF", None) is None


def test_les_commandes_transmises_ne_comptent_plus():
    """LA subtilité du module.

    Une fois transmise à Maxityre, la commande se voit dans SON stock :
    la retrancher une seconde fois la compterait deux fois et nous ferait
    refuser des ventes possibles. Seuls les états où le fournisseur
    ignore encore la commande comptent.
    """
    assert OrderStatus.pending_payment in reservation.ENGAGED_STATUSES
    assert OrderStatus.paid in reservation.ENGAGED_STATUSES
    for etat in (
        OrderStatus.sent_to_supplier,
        OrderStatus.shipped,
        OrderStatus.delivered,
        OrderStatus.cancelled,
        OrderStatus.refunded,
    ):
        assert etat not in reservation.ENGAGED_STATUSES


def test_un_panier_n_engage_rien():
    """Un panier traîne parfois trois mois. Réserver dessus fermerait la
    boutique sur les références rares."""
    assert OrderStatus.cart not in reservation.ENGAGED_STATUSES


async def test_le_verrou_porte_sur_la_reference():
    """Deux commandes sur des pneus différents ne doivent pas s'attendre.
    Le verrou est consultatif et lié à la transaction : rien à libérer à
    la main, donc rien à oublier — y compris sur erreur."""
    db = MagicMock()
    db.execute = AsyncMock()
    await reservation.lock(db, "REF-123")

    sql, params = db.execute.await_args.args
    assert "pg_advisory_xact_lock" in str(sql)
    assert params == {"ref": "REF-123"}
