"""Rejeu sûr des requêtes qui créent une commande.

Le double-clic est déjà couvert : le checkout verrouille la ligne panier
(`SELECT … FOR UPDATE`), la seconde requête attend et retombe sur
« panier vide ». Ce qui ne l'est pas, c'est le RETRY APRÈS COUPURE — le
client perd le réseau au moment de valider, ne sait pas si la commande
est passée, et recommence. Côté serveur la première a très bien pu
aboutir : deux commandes, deux paiements à rembourser.

Le client envoie alors un en-tête `Idempotency-Key` qu'il garde identique
d'une tentative à l'autre. La première requête pose une réservation dans
Redis ; les suivantes rejouent la réponse déjà produite au lieu de
refaire le travail.

Trois précautions :

* **Portée par appelant.** La clé Redis inclut l'identité (compte ou
  jeton de panier). Sans ça, une clé devinée rendrait à un tiers la
  réponse d'un checkout — numéro de commande, montant, et pour un invité
  ses jetons de session.
* **Empreinte du corps.** Rejouer la même clé avec un contenu différent
  est une erreur d'appelant, pas une reprise : on la refuse plutôt que
  de rendre la réponse d'une autre commande.
* **Réservation relâchée si rien n'a été créé.** Un checkout qui repart
  en « prix modifiés » ne doit pas figer ce refus pour une heure.
"""
from __future__ import annotations

import hashlib
import json

from fastapi import Request

from app.core.cache import get_redis
from app.core.errors import AppError, ErrorCode

# Une heure : un retry réseau se joue en secondes. Assez court pour que
# la réponse d'un invité — qui contient ses jetons de session — ne
# traîne pas dans Redis, assez long pour couvrir un client qui reprend
# son onglet plus tard.
TTL_SECONDS = 3600

_IN_PROGRESS = "__in_progress__"


class Idempotency:
    """Réservation posée pour une requête. `replay` non nul = déjà fait."""

    def __init__(
        self,
        redis_key: str | None,
        replay: dict | None,
        fingerprint: str = "",
    ) -> None:
        self.redis_key = redis_key
        self.replay = replay
        self._fingerprint = fingerprint

    async def store(self, payload: dict) -> None:
        """Fige la réponse : les rejeux ultérieurs la renverront.

        L'empreinte est RECOPIÉE à côté : sans elle, le rejeu suivant
        comparerait une empreinte absente et refuserait sa propre
        réponse en 422.
        """
        if self.redis_key is None:
            return
        await get_redis().set(
            self.redis_key,
            json.dumps(
                {"state": "done", "fp": self._fingerprint, "response": payload}
            ),
            ex=TTL_SECONDS,
        )

    async def release(self) -> None:
        """Libère la réservation : rien n'a été créé, une nouvelle
        tentative doit pouvoir travailler."""
        if self.redis_key is None:
            return
        await get_redis().delete(self.redis_key)


async def begin(request: Request, scope: str, body: object) -> Idempotency:
    """Pose la réservation, ou rend la réponse déjà produite.

    Sans en-tête `Idempotency-Key`, ne fait rien : la protection est
    facultative, un client qui l'ignore garde le comportement d'avant.
    """
    key = (request.headers.get("Idempotency-Key") or "").strip()
    if not key:
        return Idempotency(None, None)
    if len(key) > 200:
        raise AppError(
            status_code=422,
            code=ErrorCode.VALIDATION_ERROR,
            message="Idempotency-Key trop longue (200 caractères maximum).",
        )

    fingerprint = hashlib.sha256(
        json.dumps(body, sort_keys=True, default=str).encode()
    ).hexdigest()[:16]
    redis_key = f"idem:{scope}:{key}"
    redis = get_redis()

    claimed = await redis.set(
        redis_key,
        json.dumps({"state": _IN_PROGRESS, "fp": fingerprint}),
        nx=True,
        ex=TTL_SECONDS,
    )
    if claimed:
        return Idempotency(redis_key, None, fingerprint)

    # Clé déjà connue : soit la première requête tourne encore, soit elle
    # a terminé et on rejoue sa réponse.
    raw = await redis.get(redis_key)
    stored = json.loads(raw) if raw else None
    if stored is None:
        # Expirée entre le SET NX et le GET : on repart proprement.
        return Idempotency(redis_key, None, fingerprint)

    if stored.get("fp") != fingerprint:
        raise AppError(
            status_code=422,
            code=ErrorCode.VALIDATION_ERROR,
            message=(
                "Cette clé d'idempotence a déjà servi pour une requête "
                "différente. Utilisez une nouvelle clé."
            ),
        )

    if stored.get("state") == _IN_PROGRESS:
        raise AppError(
            status_code=409,
            code=ErrorCode.CONFLICT,
            message=(
                "Une requête identique est déjà en cours de traitement. "
                "Patientez quelques instants avant de réessayer."
            ),
        )

    return Idempotency(redis_key, stored.get("response") or {}, fingerprint)
