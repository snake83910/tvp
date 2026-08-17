"""
Paiement en plusieurs fois : interrupteur, et chemin de l'argent commun.

Le compte Alma n'existe pas encore. Tout ce fichier protège donc d'abord
une chose : que l'absence de compte reste SANS EFFET sur le site. Rien ne
doit s'afficher, rien ne doit tomber en panne, et surtout l'interrupteur
ne doit pas pouvoir être allumé — un bouton « payer en 3 fois » qui mène
à une erreur coûte la vente, et le client ne revient pas.

La seconde moitié couvre `apply_payment_result`, extrait pour être
partagé par la carte et le 3x/4x. C'est le chemin de l'argent : les deux
moyens de paiement doivent appliquer le MÊME contrôle de montant. Une
copie divergente se verrait chez le client, pas dans les tests.

Lancer : pytest app/tests/test_installments.py
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.integrations import alma
from app.models.order import OrderStatus
from app.modules.orders import installments
from app.modules.orders.payment_router import apply_payment_result


def _db(valeur: str | None = None) -> MagicMock:
    """Base rendant la valeur du réglage, et acceptant l'écriture."""
    db = MagicMock()
    db.scalar = AsyncMock(return_value=valeur)
    db.get = AsyncMock(return_value=None)
    db.add = MagicMock()
    db.commit = AsyncMock()
    return db


# ── L'interrupteur ────────────────────────────────────────────────

async def test_eteint_par_defaut():
    """Un moyen de paiement ne s'allume pas à la faveur d'un
    déploiement : c'est une décision, elle se prend dans l'admin."""
    assert await installments.is_enabled(_db(None)) is False


async def test_allumage_refuse_sans_cle(monkeypatch):
    monkeypatch.setattr(settings, "alma_api_key", "")
    with pytest.raises(ValueError, match="ALMA_API_KEY"):
        await installments.set_enabled(_db(), True)


async def test_extinction_toujours_possible(monkeypatch):
    """Même sans clé : couper doit marcher en toutes circonstances,
    c'est le geste d'urgence."""
    monkeypatch.setattr(settings, "alma_api_key", "")
    await installments.set_enabled(_db("1"), False)


async def test_allumage_accepte_avec_cle(monkeypatch):
    monkeypatch.setattr(settings, "alma_api_key", "sk_test_x")
    await installments.set_enabled(_db(), True)


# ── Ce qu'on propose au client ────────────────────────────────────

async def test_rien_propose_si_eteint(monkeypatch):
    monkeypatch.setattr(settings, "alma_api_key", "sk_test_x")
    assert await installments.options_for(_db("0"), 40000) == []


async def test_rien_propose_sans_cle(monkeypatch):
    """Allumé en base mais clé retirée depuis : on n'affiche rien plutôt
    que d'envoyer le client dans le mur."""
    monkeypatch.setattr(settings, "alma_api_key", "")
    assert await installments.options_for(_db("1"), 40000) == []


async def test_l_eligibilite_est_demandee_a_alma(monkeypatch):
    """Les planchers et plafonds dépendent du contrat : c'est Alma qui
    tranche, pas une constante chez nous."""
    monkeypatch.setattr(settings, "alma_api_key", "sk_test_x")
    monkeypatch.setattr(alma, "eligibility", AsyncMock(return_value=[3]))
    assert await installments.options_for(_db("1"), 40000) == [3]


async def test_alma_injoignable_fait_disparaitre_l_option(monkeypatch):
    """Un fournisseur en panne retire l'option ; il n'empêche jamais de
    payer par carte. D'où un `eligibility` qui rend une liste vide au
    lieu de lever — on l'éprouve contre un port fermé, pas contre une
    simulation qui ne prouverait que le comportement du mock."""
    monkeypatch.setattr(settings, "alma_api_key", "sk_test_x")
    monkeypatch.setattr(alma, "base_url", lambda: "http://127.0.0.1:1")

    assert await alma.eligibility(40000) == []
    assert await installments.options_for(_db("1"), 40000) == []


# ── Le chemin de l'argent, partagé ────────────────────────────────

def _commande(total_cents: int = 11976):
    order = MagicMock()
    order.status = OrderStatus.pending_payment
    order.total_ttc_cents = total_cents
    return order


async def test_montant_different_ne_valide_jamais():
    """Paiement partiel, ou montant altéré côté prestataire : la
    commande ne bascule pas. Vaut pour la carte comme pour le 3x/4x,
    puisque c'est le même code."""
    order = _commande(11976)
    payment = MagicMock()
    db = _db()

    with pytest.raises(HTTPException) as exc:
        await apply_payment_result(
            db, payment, order, success=True, amount_cents=5000
        )

    assert exc.value.status_code == 400
    assert payment.status == "amount_mismatch"
    order.transition_to.assert_not_called()


async def test_echec_marque_le_paiement_sans_toucher_la_commande():
    order = _commande()
    payment = MagicMock()

    paye = await apply_payment_result(
        _db(), payment, order, success=False, amount_cents=11976
    )

    assert paye is False
    assert payment.status == "failed"
    order.transition_to.assert_not_called()
