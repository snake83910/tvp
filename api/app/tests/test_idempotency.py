"""
Rejeu des requêtes qui créent une commande.

Le double-clic était déjà couvert par le verrou sur le panier. Ce qui ne
l'était pas : le client perd le réseau en validant, ignore si sa commande
est passée, et recommence — la première ayant très bien pu aboutir côté
serveur. Deux commandes, deux paiements à rembourser.

Ces tests utilisent le vrai Redis (présent dans le conteneur et en CI) :
la garantie repose entièrement sur l'atomicité du SET NX, la simuler ne
prouverait rien.

Lancer : pytest app/tests/test_idempotency.py
"""
import uuid

import pytest
from fastapi import HTTPException

from app.core import idempotency


@pytest.fixture(autouse=True)
def _redis_par_test():
    """Rend le client Redis à chaque test.

    `get_redis()` met son client en cache dans une globale, liée à la
    boucle d'événements qui l'a créé. Or pytest-asyncio en ouvre une par
    test : le second réutilisait un client attaché à une boucle fermée
    (« Event loop is closed »). Le produit, lui, tourne sur une seule
    boucle — c'est une contrainte de test, pas un défaut applicatif.
    """
    from app.core import cache

    cache._redis = None
    yield
    cache._redis = None


class FakeRequest:
    """Porte juste l'en-tête : `begin` ne lit rien d'autre."""

    def __init__(self, key: str | None) -> None:
        self.headers = {"Idempotency-Key": key} if key else {}


def _scope() -> str:
    return f"test:{uuid.uuid4().hex}"


BODY = {"email": "a@b.fr", "total": 42}


async def test_sans_en_tete_la_protection_est_transparente():
    """Un client qui ignore l'en-tête garde le comportement d'avant."""
    idem = await idempotency.begin(FakeRequest(None), _scope(), BODY)
    assert idem.redis_key is None and idem.replay is None
    # Les opérations restent sans effet, sans planter.
    await idem.store({"order_number": "X"})
    await idem.release()


async def test_le_rejeu_rend_la_reponse_figee():
    scope, key = _scope(), uuid.uuid4().hex
    first = await idempotency.begin(FakeRequest(key), scope, BODY)
    assert first.replay is None
    await first.store({"order_number": "CMD-1", "total_ttc": 42.0})

    second = await idempotency.begin(FakeRequest(key), scope, BODY)
    assert second.replay == {"order_number": "CMD-1", "total_ttc": 42.0}


async def test_une_requete_encore_en_cours_est_refusee():
    """Réservation posée mais pas encore honorée : 409 plutôt que de
    laisser deux traitements concurrents créer deux commandes."""
    scope, key = _scope(), uuid.uuid4().hex
    await idempotency.begin(FakeRequest(key), scope, BODY)
    with pytest.raises(HTTPException) as exc:
        await idempotency.begin(FakeRequest(key), scope, BODY)
    assert exc.value.status_code == 409


async def test_meme_cle_corps_different_est_refuse():
    """Erreur d'appelant, pas une reprise : rendre la réponse d'une AUTRE
    commande serait pire que refuser."""
    scope, key = _scope(), uuid.uuid4().hex
    first = await idempotency.begin(FakeRequest(key), scope, BODY)
    await first.store({"order_number": "CMD-1"})
    with pytest.raises(HTTPException) as exc:
        await idempotency.begin(
            FakeRequest(key), scope, {**BODY, "total": 99}
        )
    assert exc.value.status_code == 422


async def test_la_liberation_autorise_une_nouvelle_tentative():
    """Rien n'a été créé (prix modifiés, refus métier) : la clé doit
    redevenir utilisable, sinon le client reste bloqué une heure."""
    scope, key = _scope(), uuid.uuid4().hex
    first = await idempotency.begin(FakeRequest(key), scope, BODY)
    await first.release()
    second = await idempotency.begin(FakeRequest(key), scope, BODY)
    assert second.replay is None


async def test_la_portee_isole_les_appelants():
    """Une clé devinée ne doit pas rendre la commande d'un tiers."""
    key = uuid.uuid4().hex
    mine = await idempotency.begin(FakeRequest(key), _scope(), BODY)
    await mine.store({"order_number": "CMD-SECRET"})
    autre = await idempotency.begin(FakeRequest(key), _scope(), BODY)
    assert autre.replay is None


async def test_cle_trop_longue_refusee():
    with pytest.raises(HTTPException) as exc:
        await idempotency.begin(FakeRequest("x" * 201), _scope(), BODY)
    assert exc.value.status_code == 422
