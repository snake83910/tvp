"""
Service mail : API métier de haut niveau.

Le code métier (auth, paiement, orders) ne touche PAS directement au
Mailer ni aux templates. Il appelle des méthodes claires comme
`send_order_confirmation(order)` et c'est tout.

Cette indirection paie quand on voudra :
- Changer le template (UI marketing)
- Tester sans envoyer (mode console)
- Ajouter du tracking (timestamp envoi en DB, ré-essais...)
- Internationaliser

Tous les appels passent par fire_and_forget pour ne PAS bloquer la
réponse HTTP. Un email qui rate = log, jamais une commande qui plante.
"""
from __future__ import annotations

import logging

from app.core.config import settings
from app.models.order import Order
from app.models.user import User
from app.modules.mailer import get_mailer
from app.modules.mailer.base import fire_and_forget

log = logging.getLogger(__name__)


# URL publique du site (utilisée dans les liens des emails).
# En dev : http://localhost:3000. En prod : https://tousvospneus.com.
def _site_url() -> str:
    return settings.public_site_url or "http://localhost:3000"


def _civilite(user: User) -> str:
    """Formule d'appel : prénom si dispo, sinon 'Bonjour'."""
    if user.first_name:
        return f"Bonjour {user.first_name}"
    return "Bonjour"


# ─────────────────────────────────────────────────────────────────
# Inscription
# ─────────────────────────────────────────────────────────────────

def send_welcome(user: User) -> None:
    """Email de bienvenue après inscription."""
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject="Bienvenue chez Tous Vos Pneus",
            template="welcome.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            login_url=f"{_site_url()}/connexion",
        )
    )


def send_verify_email(user: User, token: str) -> None:
    """Email de vérification après inscription."""
    mailer = get_mailer()
    verify_url = f"{_site_url()}/verifier-email?token={token}"
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject="Vérifiez votre adresse email",
            template="verify_email.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            verify_url=verify_url,
        )
    )


def send_password_reset(user: User, token: str) -> None:
    """Email avec lien de reset password."""
    mailer = get_mailer()
    reset_url = f"{_site_url()}/reinitialiser-mot-de-passe?token={token}"
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject="Réinitialisation de votre mot de passe",
            template="password_reset.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            reset_url=reset_url,
        )
    )


# ─────────────────────────────────────────────────────────────────
# Confirmation de commande (paiement validé)
# ─────────────────────────────────────────────────────────────────

def send_order_confirmation(order: Order, user: User) -> None:
    """Email de confirmation après paiement validé.

    Le destinataire = email du compte qui a passé commande. On fige
    tout : si l'utilisateur change d'email plus tard, la trace dans la
    commande reste celle de l'achat.
    """
    mailer = get_mailer()
    items_view = [
        {
            "label": it.label_snapshot,
            "qty": it.quantity,
            "unit_ttc": round(it.unit_price_ht_cents * (1 + it.vat_rate / 100) / 100, 2),
            "line_ttc": round(it.unit_price_ht_cents * it.quantity * (1 + it.vat_rate / 100) / 100, 2),
        }
        for it in order.items
    ]
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Confirmation de votre commande {order.order_number}",
            template="order_confirmation.html",
            civilite=_civilite(user),
            order_number=order.order_number,
            items=items_view,
            shipping_address=order.shipping_address,
            shipping_ttc=round(
                (order.shipping_ht_cents + order.shipping_vat_cents) / 100, 2
            ),
            total_ttc=round(order.total_ttc_cents / 100, 2),
            order_url=f"{_site_url()}/commandes/{order.order_number}",
            site_url=_site_url(),
        )
    )


# ─────────────────────────────────────────────────────────────────
# Expédition
# ─────────────────────────────────────────────────────────────────

def send_order_shipped(
    order: Order,
    user: User,
    tracking_number: str | None = None,
    carrier: str | None = None,
) -> None:
    """Email quand la commande est expédiée (statut shipped)."""
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Votre commande {order.order_number} est expédiée",
            template="order_shipped.html",
            civilite=_civilite(user),
            order_number=order.order_number,
            shipping_address=order.shipping_address,
            tracking_number=tracking_number,
            carrier=carrier,
            order_url=f"{_site_url()}/commandes/{order.order_number}",
            site_url=_site_url(),
        )
    )


# ─────────────────────────────────────────────────────────────────
# Livrée
# ─────────────────────────────────────────────────────────────────

def send_order_delivered(order: Order, user: User) -> None:
    """Email quand la commande est livrée (statut delivered)."""
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Votre commande {order.order_number} est livrée",
            template="order_delivered.html",
            civilite=_civilite(user),
            order_number=order.order_number,
            order_url=f"{_site_url()}/commandes/{order.order_number}",
            site_url=_site_url(),
        )
    )


# ─────────────────────────────────────────────────────────────────
# Annulation
# ─────────────────────────────────────────────────────────────────

def send_order_cancelled(
    order: Order, user: User, reason: str | None = None
) -> None:
    """Email d'annulation (statut cancelled).

    Si le paiement avait été capturé, le remboursement est traité
    séparément côté Sogecommerce ; ce mail informe juste le client
    de l'annulation.
    """
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Votre commande {order.order_number} a été annulée",
            template="order_cancelled.html",
            civilite=_civilite(user),
            order_number=order.order_number,
            reason=reason or "",
            total_ttc=round(order.total_ttc_cents / 100, 2),
            site_url=_site_url(),
        )
    )
