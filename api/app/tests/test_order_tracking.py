"""
Suivi de commande sans connexion.

Ce que ce fichier protège : le couple numéro + email est bien plus
facile à obtenir qu'une session — il suffit d'avoir vu passer l'email de
confirmation, ou d'être un proche du client. Deux garanties en
découlent, et aucune n'est évidente à la relecture du code :

  * la réponse ne doit RIEN contenir de plus que l'avancement. Pas
    d'adresse postale, pas de nom. Un champ ajouté par confort dans
    OrderTrackingOut ferait fuiter le dossier client ;
  * l'échec doit être indiscernable. Numéro inconnu et mauvais email
    donnent le même message : sinon l'endpoint révèle quelles commandes
    existent, et permet de chercher l'adresse de l'acheteur.

Lancer : pytest app/tests/test_order_tracking.py
"""
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.errors import AppError
from app.models.order import OrderStatus
from app.modules.orders.tracking_router import track_order
from app.schemas.order import OrderTrackingIn, OrderTrackingOut


@pytest.fixture(autouse=True)
def _redis_par_test():
    """Le plafond de débit passe par Redis, dont le client est mis en
    cache dans une globale liée à sa boucle d'événements. pytest-asyncio
    en ouvre une par test : sans cette remise à zéro, le deuxième test
    réutilise un client attaché à une boucle fermée."""
    from app.core import cache

    cache._redis = None
    yield
    cache._redis = None


class FakeRequest:
    """Le plafond de débit lit l'IP de l'appelant, rien d'autre."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}
        self.client = MagicMock(host=f"10.0.0.{uuid.uuid4().int % 255}")
        self.url = MagicMock(path="/v1/orders/track")


def _commande():
    item = MagicMock()
    item.quantity = 2
    item.label_snapshot = "Michelin Primacy 4 205/55 R16 91V"

    order = MagicMock()
    order.order_number = "CMD-2026-000123"
    order.status = OrderStatus.shipped
    order.created_at = datetime(2026, 8, 1, tzinfo=UTC)
    order.paid_at = datetime(2026, 8, 1, tzinfo=UTC)
    order.delivery_mode = "home"
    order.total_ttc_cents = 11976
    order.items = [item]
    order.tracking_number = "6A12345678901"
    order.carrier = "Colissimo"
    order.tracking_url = "https://exemple.fr/suivi"
    order.garage_snapshot = {
        "name": "Garage Rivaz",
        "city": "Lyon",
        # Présents dans le snapshot, ne doivent PAS ressortir.
        "address": "12 avenue Jean Jaurès",
        "phone": "04 78 00 00 00",
    }
    return order


def _db(order):
    db = MagicMock()
    db.scalar = AsyncMock(return_value=order)
    return db


async def test_couple_valide_rend_l_avancement():
    out = await track_order(
        OrderTrackingIn(order_number="CMD-2026-000123", email="a@b.fr"),
        FakeRequest(),
        db=_db(_commande()),
    )
    assert out.status == "shipped"
    assert out.item_count == 2
    assert out.tracking_number == "6A12345678901"


async def test_numero_inconnu_et_mauvais_email_indiscernables():
    """Une seule et même réponse : sinon on énumère les commandes, puis
    on cherche l'adresse de l'acheteur sur un numéro connu."""
    messages = set()
    for _ in range(2):
        with pytest.raises(AppError) as exc:
            await track_order(
                OrderTrackingIn(order_number="CMD-2026-000123", email="a@b.fr"),
                FakeRequest(),
                db=_db(None),
            )
        assert exc.value.status_code == 404
        messages.add(exc.value.message)
    assert len(messages) == 1


async def test_aucune_donnee_personnelle_dans_la_reponse():
    """Le garde-fou de fond. Un champ ajouté par confort à
    OrderTrackingOut — nom, adresse, téléphone — fait échouer ce test."""
    interdits = {
        "shipping_address", "billing_address", "first_name", "last_name",
        "phone", "email", "garage_address", "garage_phone", "invoice_number",
    }
    assert interdits.isdisjoint(OrderTrackingOut.model_fields)


async def test_le_garage_ne_rend_que_nom_et_ville():
    """Le snapshot du garage porte son adresse et son téléphone. On en
    extrait deux champs, pas le dictionnaire entier."""
    out = await track_order(
        OrderTrackingIn(order_number="CMD-2026-000123", email="a@b.fr"),
        FakeRequest(),
        db=_db(_commande()),
    )
    rendu = out.model_dump_json()
    assert "Garage Rivaz" in rendu and "Lyon" in rendu
    assert "avenue Jean Jaurès" not in rendu
    assert "04 78 00 00 00" not in rendu


async def test_les_prix_unitaires_ne_sortent_pas():
    """Seuls les libellés partent : le détail des lignes appartient à la
    facture, qui exige une session."""
    out = await track_order(
        OrderTrackingIn(order_number="CMD-2026-000123", email="a@b.fr"),
        FakeRequest(),
        db=_db(_commande()),
    )
    assert out.items == ["Michelin Primacy 4 205/55 R16 91V"]
    assert all(isinstance(x, str) for x in out.items)


def test_le_numero_est_normalise_avant_recherche():
    """Saisie au clavier : minuscules et espaces sont courants. La
    normalisation se fait dans le routeur, ce test documente l'entrée
    telle qu'elle arrive — le schéma, lui, ne doit pas la rejeter."""
    data = OrderTrackingIn(order_number=" cmd-2026-000123 ", email="A@B.FR")
    assert data.email == "a@b.fr"
    assert data.order_number.strip().upper() == "CMD-2026-000123"
