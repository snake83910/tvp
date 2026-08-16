"""Codes à usage unique envoyés par email.

Pourquoi un code plutôt qu'un lien. Le lien suppose que le destinataire
ouvre sa boîte DANS le navigateur où il est en train d'agir. Au milieu
d'un tunnel de commande, sur un téléphone, c'est précisément ce qu'il ne
fait pas : il bascule sur son application mail, revient, et retrouve un
onglet qu'il n'a jamais quitté. Six chiffres à recopier laissent la page
de commande intacte.

Le code vit dans Redis, jamais en base : il expire en dix minutes et ne
survit pas à sa vérification. Le stocker durablement reviendrait à
garder une clé d'accès au compte bien après qu'elle a servi.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets

from app.core.cache import get_redis

#: Six chiffres : assez court pour être recopié de mémoire depuis
#: l'application mail, assez long pour que le plafond de tentatives
#: ci-dessous rende la devinette sans espoir.
LENGTH = 6

#: Dix minutes. Au-delà, l'utilisateur a de toute façon quitté la page ;
#: en deçà, un mail lent le ferait échouer sans qu'il comprenne pourquoi.
TTL = 600

#: Le vrai rempart contre la force brute. Un code à 6 chiffres se devine
#: en 10^6 essais ; à cinq tentatives, la probabilité de tomber juste est
#: de 1 sur 200 000, et le code est brûlé ensuite.
MAX_ATTEMPTS = 5

#: Anti-pilonnage de boîte mail : un renvoi par minute au plus.
RESEND_COOLDOWN = 60

#: Espace de nommage des codes de vérification d'adresse. Isole ce
#: mécanisme d'un éventuel autre usage (2FA par mail, validation d'un
#: numéro de téléphone) : deux codes en vol ne doivent jamais pouvoir
#: être intervertis.
EMAIL_VERIFY = "email_verify"


def _fingerprint(purpose: str, key: str, code: str) -> str:
    """Empreinte salée du code.

    Ne prétend PAS résister à une force brute — 10^6 possibilités se
    parcourent instantanément. Le but est plus modeste : que le code ne
    circule pas en clair dans un dump Redis, une sauvegarde ou une
    commande `KEYS *` passée par-dessus l'épaule.
    """
    return hashlib.sha256(f"{purpose}:{key}:{code}".encode()).hexdigest()


def _slot(purpose: str, key: str) -> str:
    return f"otp:{purpose}:{key}"


def _normalize(key: str) -> str:
    """Une seule forme de clé, à l'émission comme à la vérification.

    La normaliser à un seul des deux endroits suffit à créer un piège :
    l'emplacement Redis serait trouvé, l'empreinte non, et un code
    parfaitement valide serait rejeté sans explication.
    """
    return key.strip().lower()


async def issue(purpose: str, key: str) -> str | None:
    """Émet un code, ou None si un renvoi a déjà eu lieu il y a moins
    d'une minute.

    Le None n'est pas une erreur : l'appelant s'abstient d'envoyer un
    second mail, et l'utilisateur garde le code qu'il a déjà reçu.
    """
    redis = get_redis()
    key = _normalize(key)
    slot = _slot(purpose, key)
    if not await redis.set(f"{slot}:cd", "1", ex=RESEND_COOLDOWN, nx=True):
        return None

    code = f"{secrets.randbelow(10 ** LENGTH):0{LENGTH}d}"
    # Pipeline : le code et son compteur de tentatives doivent apparaître
    # ensemble. Un code sans compteur serait vérifiable sans plafond.
    async with redis.pipeline(transaction=True) as pipe:
        pipe.set(slot, _fingerprint(purpose, key, code), ex=TTL)
        pipe.set(f"{slot}:n", 0, ex=TTL)
        await pipe.execute()
    return code


async def check(purpose: str, key: str, code: str) -> bool:
    """Consomme le code. Vrai une seule fois, faux ensuite."""
    redis = get_redis()
    key = _normalize(key)
    slot = _slot(purpose, key)

    expected = await redis.get(slot)
    if expected is None:
        return False

    # Incrémenter AVANT de comparer : une comparaison qui lèverait (Redis
    # coupé, valeur corrompue) ne doit pas offrir un essai gratuit.
    attempts = await redis.incr(f"{slot}:n")
    if attempts > MAX_ATTEMPTS:
        await redis.delete(slot, f"{slot}:n")
        return False

    if not hmac.compare_digest(expected, _fingerprint(purpose, key, code)):
        return False

    await redis.delete(slot, f"{slot}:n")
    return True
