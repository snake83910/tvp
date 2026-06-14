"""
Abstraction du paiement.

Même principe que le connecteur fournisseur : une interface, plusieurs
implémentations. On développe avec SimulatedPayment (aucun contrat requis),
et on bascule sur SogecommercePayment quand le contrat bancaire est actif —
sans toucher au reste du code.

Règle de sécurité absolue (cf. doc archi) : une commande n'est JAMAIS
validée sur le retour navigateur. Uniquement sur le webhook IPN serveur,
signature vérifiée, traitement idempotent.
"""
import base64
import hashlib
import hmac
import json
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class PaymentInit:
    """Ce qu'on renvoie au front pour démarrer le paiement."""

    provider: str
    provider_ref: str
    form_token: str          # jeton à passer au formulaire de paiement
    amount_cents: int
    public_key: str = ""     # clé publique Sogecommerce (vide en simulé)


@dataclass
class IPNResult:
    """Résultat de la vérification d'un webhook de paiement."""

    provider_ref: str
    amount_cents: int
    success: bool
    signature_ok: bool
    raw: dict


class PaymentProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    async def init_payment(
        self, order_id: str, amount_cents: int
    ) -> PaymentInit:
        ...

    @abstractmethod
    def verify_ipn(self, payload: dict, signature: str | None) -> IPNResult:
        """Vérifie la signature et extrait le résultat. Jamais de confiance
        aveugle dans le payload."""
        ...


class SimulatedPayment(PaymentProvider):
    """
    Mode développement. Simule un paiement réussi. Permet de construire et
    tester tout le tunnel commande sans le contrat Sogecommerce.
    NE JAMAIS activer en production (settings.environment == 'production').
    """

    name = "simulated"

    async def init_payment(
        self, order_id: str, amount_cents: int
    ) -> PaymentInit:
        ref = f"SIM-{uuid.uuid4().hex[:12]}"
        return PaymentInit(
            provider=self.name,
            provider_ref=ref,
            form_token=f"simtoken-{ref}",
            amount_cents=amount_cents,
        )

    def verify_ipn(self, payload: dict, signature: str | None) -> IPNResult:
        # En simulation on signe avec le secret JWT pour rester réaliste
        expected = hmac.new(
            settings.jwt_secret.encode(),
            str(payload.get("provider_ref", "")).encode(),
            hashlib.sha256,
        ).hexdigest()
        sig_ok = hmac.compare_digest(expected, signature or "")
        return IPNResult(
            provider_ref=payload.get("provider_ref", ""),
            amount_cents=int(payload.get("amount_cents", 0)),
            success=payload.get("status") == "PAID" and sig_ok,
            signature_ok=sig_ok,
            raw=payload,
        )


class SogecommercePayment(PaymentProvider):
    """
    Intégration Sogecommerce (techno PayZen/Lyra V4), mode PAGE REDIRIGÉE.

    Flux :
      1. init_payment -> POST Charge/CreatePayment (serveur à serveur)
         -> récupère un formToken
      2. le front charge la librairie JS Sogecommerce avec ce formToken
         et la clé publique -> le client paie sur la page hébergée banque
      3. Sogecommerce notifie le serveur via IPN (webhook) signé HMAC
      4. verify_ipn vérifie la signature kr-hash AVANT de valider

    Sécurité (confirmée par la doc Sogecommerce) : le Web Service n'est
    JAMAIS appelé depuis le navigateur, et le montant est vérifié côté
    serveur. La commande n'est validée que sur l'IPN signé.

    Test vs production : piloté uniquement par les clés dans .env
    (clés préfixées 'testpassword_' = test). Aucun changement de code.
    """

    name = "sogecommerce"
    _BASE = "https://api-sogecommerce.societegenerale.eu/api-payment/V4"
    _API = f"{_BASE}/Charge/CreatePayment"

    def _auth_header(self) -> str:
        shop = settings.sogecommerce_shop_id
        pwd = settings.sogecommerce_api_password
        if not shop or not pwd:
            raise RuntimeError(
                "Sogecommerce non configuré : renseigner "
                "SOGECOMMERCE_SHOP_ID et SOGECOMMERCE_API_PASSWORD "
                "dans .env (clés du Back Office, onglet Clés d'API REST)."
            )
        token = base64.b64encode(f"{shop}:{pwd}".encode()).decode()
        return f"Basic {token}"

    async def init_payment(
        self, order_id: str, amount_cents: int
    ) -> PaymentInit:
        # orderId Sogecommerce = notre référence commande (pas l'UUID interne)
        payload = {
            "amount": amount_cents,          # déjà en centimes
            "currency": "EUR",
            "orderId": order_id,
            "formAction": "PAYMENT",
            "ipnTargetUrl": settings.sogecommerce_ipn_url,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                self._API,
                headers={
                    "Authorization": self._auth_header(),
                    "Content-Type": "application/json",
                },
                content=json.dumps(payload),
            )
        resp.raise_for_status()
        body = resp.json()
        if body.get("status") != "SUCCESS":
            err = body.get("answer", {})
            raise RuntimeError(
                f"Sogecommerce CreatePayment a échoué : "
                f"{err.get('errorCode')} {err.get('errorMessage')}"
            )
        answer = body["answer"]
        form_token = answer["formToken"]
        return PaymentInit(
            provider=self.name,
            provider_ref=order_id,
            form_token=form_token,
            amount_cents=amount_cents,
            public_key=settings.sogecommerce_public_key,
        )

    async def get_order_status(self, order_uuid: str) -> dict:
        """Interroge Sogecommerce pour connaître le statut d'un paiement.
        Fallback quand l'IPN n'arrive pas (dev local sans ngrok)."""
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{self._BASE}/Order/Get",
                headers={
                    "Authorization": self._auth_header(),
                    "Content-Type": "application/json",
                },
                content=json.dumps({"orderId": order_uuid}),
            )
        resp.raise_for_status()
        body = resp.json()
        if body.get("status") != "SUCCESS":
            raise RuntimeError(f"Order/Get échoué : {body.get('answer', {})}")
        return body["answer"]

    def verify_ipn(self, payload: dict, signature: str | None) -> IPNResult:
        """
        IPN Sogecommerce : le corps contient 'kr-answer' (JSON string) et
        'kr-hash'. La signature = HMAC-SHA256(kr-answer) avec la clé HMAC
        du Back Office (kr-answer signé avec la 2e clé, pas la clé API).
        On NE fait jamais confiance au payload sans signature valide.
        """
        secret = settings.sogecommerce_hmac_key
        if not secret:
            raise RuntimeError(
                "SOGECOMMERCE_HMAC_KEY non configurée "
                "(Back Office -> Clés d'API REST -> clé HMAC-SHA256)."
            )

        kr_answer = payload.get("kr-answer")
        kr_hash = payload.get("kr-hash") or signature
        if kr_answer is None or not kr_hash:
            return IPNResult("", 0, False, False, payload)

        computed = hmac.new(
            secret.encode(),
            kr_answer.encode() if isinstance(kr_answer, str)
            else json.dumps(kr_answer).encode(),
            hashlib.sha256,
        ).hexdigest()
        sig_ok = hmac.compare_digest(computed, kr_hash)

        # kr-answer est une chaîne JSON : on la parse pour extraire l'état
        try:
            answer = (
                json.loads(kr_answer)
                if isinstance(kr_answer, str)
                else kr_answer
            )
        except (ValueError, TypeError):
            return IPNResult("", 0, False, sig_ok, payload)

        order_status = answer.get("orderStatus")  # PAID / UNPAID / ...
        order_id = answer.get("orderDetails", {}).get(
            "orderId", ""
        )
        # Montant payé : dans la 1re transaction
        txns = answer.get("transactions") or [{}]
        amount = txns[0].get("amount", 0)

        return IPNResult(
            provider_ref=order_id,
            amount_cents=int(amount),
            success=(order_status == "PAID" and sig_ok),
            signature_ok=sig_ok,
            raw=answer,
        )


def get_payment_provider() -> PaymentProvider:
    """Sélection du provider selon la config. Simulé tant que Sogecommerce
    n'est pas activé."""
    if settings.payment_provider == "sogecommerce":
        return SogecommercePayment()
    return SimulatedPayment()
