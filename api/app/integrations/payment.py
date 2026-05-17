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
import hashlib
import hmac
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class PaymentInit:
    """Ce qu'on renvoie au front pour démarrer le paiement."""

    provider: str
    provider_ref: str
    form_token: str          # jeton à passer au formulaire de paiement
    amount_cents: int


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
    Ossature Sogecommerce / PayZen. À compléter quand le contrat bancaire
    est actif (clés API, endpoint form token, secret HMAC IPN fournis par
    la banque). La logique de vérification HMAC est déjà posée.
    """

    name = "sogecommerce"

    async def init_payment(
        self, order_id: str, amount_cents: int
    ) -> PaymentInit:
        raise NotImplementedError(
            "Sogecommerce : à activer avec les identifiants du contrat "
            "bancaire (clé boutique, mot de passe API, certificat HMAC)."
        )

    def verify_ipn(self, payload: dict, signature: str | None) -> IPNResult:
        # PayZen renvoie un kr-hash signé HMAC-SHA256 avec la clé HMAC du
        # contrat. Schéma de vérification (clé à brancher) :
        secret = settings.sogecommerce_hmac_key
        if not secret:
            raise NotImplementedError(
                "Clé HMAC Sogecommerce non configurée "
                "(SOGECOMMERCE_HMAC_KEY)."
            )
        computed = hmac.new(
            secret.encode(),
            str(payload.get("kr-answer", "")).encode(),
            hashlib.sha256,
        ).hexdigest()
        sig_ok = hmac.compare_digest(computed, signature or "")
        return IPNResult(
            provider_ref=payload.get("provider_ref", ""),
            amount_cents=int(payload.get("amount_cents", 0)),
            success=payload.get("status") == "PAID" and sig_ok,
            signature_ok=sig_ok,
            raw=payload,
        )


def get_payment_provider() -> PaymentProvider:
    """Sélection du provider selon la config. Simulé tant que Sogecommerce
    n'est pas activé."""
    if settings.payment_provider == "sogecommerce":
        return SogecommercePayment()
    return SimulatedPayment()
