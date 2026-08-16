"""
Codes de vérification d'adresse email.

Ce code est ce qui sépare une commande d'un paiement, pour un client
invité. Ses garanties ne sont pas décoratives :

  * usage unique — sinon un code intercepté resterait valable ;
  * plafond de tentatives — six chiffres se devinent en 10^6 essais,
    seul le plafond rend cette recherche vaine ;
  * verrou de renvoi — sans lui, l'endpoint d'envoi devient une arme
    pour inonder la boîte mail d'un tiers.

Ces tests utilisent le vrai Redis (présent dans le conteneur et en CI) :
les garanties reposent sur l'atomicité de SET NX et de INCR, les
simuler ne prouverait rien.

Lancer : pytest app/tests/test_otp.py
"""
import uuid

import pytest

from app.core import otp


@pytest.fixture(autouse=True)
def _redis_par_test():
    """Rend le client Redis à chaque test.

    `get_redis()` met son client en cache dans une globale liée à la
    boucle d'événements qui l'a créé, et pytest-asyncio en ouvre une par
    test. Contrainte de test, pas défaut applicatif : le produit tourne
    sur une seule boucle.
    """
    from app.core import cache

    cache._redis = None
    yield
    cache._redis = None


def _adresse() -> str:
    """Adresse neuve à chaque test : le verrou de renvoi porte sur elle,
    deux tests qui la partageraient s'empêcheraient mutuellement."""
    return f"{uuid.uuid4().hex}@example.com"


async def test_code_a_six_chiffres():
    code = await otp.issue(otp.EMAIL_VERIFY, _adresse())
    assert code is not None
    assert len(code) == otp.LENGTH and code.isdigit()


async def test_le_bon_code_passe():
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    assert await otp.check(otp.EMAIL_VERIFY, email, code) is True


async def test_usage_unique():
    """Un code déjà consommé ne vaut plus rien : sinon, celui qui le lit
    par-dessus l'épaule du client peut encore s'en servir."""
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    assert await otp.check(otp.EMAIL_VERIFY, email, code) is True
    assert await otp.check(otp.EMAIL_VERIFY, email, code) is False


async def test_mauvais_code_refuse():
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    faux = "000000" if code != "000000" else "111111"
    assert await otp.check(otp.EMAIL_VERIFY, email, faux) is False


async def test_code_brule_apres_cinq_echecs():
    """Le vrai rempart contre la force brute. Sans lui, 10^6 requêtes
    suffisent à valider n'importe quelle adresse."""
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    faux = "000000" if code != "000000" else "111111"

    for _ in range(otp.MAX_ATTEMPTS):
        assert await otp.check(otp.EMAIL_VERIFY, email, faux) is False

    # Le bon code lui-même ne passe plus : le code est mort, pas
    # seulement la tentative.
    assert await otp.check(otp.EMAIL_VERIFY, email, code) is False


async def test_adresse_sans_code_refusee():
    """Vérifier sans avoir rien demandé ne doit jamais aboutir."""
    assert await otp.check(otp.EMAIL_VERIFY, _adresse(), "123456") is False


async def test_verrou_de_renvoi():
    """Deuxième demande immédiate : None, donc aucun mail. L'appelant
    n'envoie rien plutôt que de pilonner la boîte."""
    email = _adresse()
    assert await otp.issue(otp.EMAIL_VERIFY, email) is not None
    assert await otp.issue(otp.EMAIL_VERIFY, email) is None


async def test_codes_cloisonnes_par_usage():
    """Un code émis pour vérifier une adresse ne doit pas être
    acceptable ailleurs, le jour où un second usage existera."""
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    assert await otp.check("autre_usage", email, code) is False


async def test_adresse_insensible_a_la_casse():
    """Les emails sont normalisés en minuscules à l'entrée de l'API,
    mais le module ne doit pas dépendre de cette politesse."""
    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    assert await otp.check(otp.EMAIL_VERIFY, email.upper(), code) is True


async def test_le_code_ne_traine_pas_en_clair():
    """Ce qui est stocké ne doit pas être le code lui-même : un dump
    Redis ou une sauvegarde ne doit pas livrer des codes utilisables.
    (Ne prétend pas résister à une force brute sur 10^6 valeurs.)"""
    from app.core.cache import get_redis

    email = _adresse()
    code = await otp.issue(otp.EMAIL_VERIFY, email)
    stocke = await get_redis().get(f"otp:{otp.EMAIL_VERIFY}:{email}")
    assert stocke is not None
    assert code not in stocke
