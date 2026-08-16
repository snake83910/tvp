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
from datetime import UTC

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


def send_login_alert(user: User, ip: str | None, user_agent: str | None) -> None:
    """Email d'alerte de connexion admin."""
    mailer = get_mailer()
    from datetime import datetime
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject="Nouvelle connexion à votre compte admin",
            template="login_alert.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            login_time=datetime.now(UTC).strftime("%d/%m/%Y à %H:%M UTC"),
            login_ip=ip or "inconnue",
            login_ua=(user_agent or "inconnu")[:120],
        )
    )


def send_email_change_confirm(user: User, new_email: str, token: str) -> None:
    """Lien de confirmation envoyé sur le NOUVEL email."""
    mailer = get_mailer()
    url = f"{_site_url()}/confirmer-email?token={token}"
    fire_and_forget(
        mailer.send_template(
            to=new_email,
            subject="Confirmez votre nouvelle adresse email",
            template="email_change_confirm.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            confirm_url=url,
            new_email=new_email,
        )
    )


def send_email_changed_notice(
    old_email: str, user: User, new_email: str
) -> None:
    """Alerte envoyée sur l'ANCIENNE adresse une fois le changement
    effectif : si le titulaire n'est pas à l'origine du changement,
    c'est son seul moyen de s'en apercevoir."""
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=old_email,
            subject="L'adresse email de votre compte a été modifiée",
            template="email_change_notice.html",
            civilite=_civilite(user),
            site_url=_site_url(),
            new_email=new_email,
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
            # Affichée uniquement si dissociée de la livraison
            billing_address=(
                order.billing_address
                if order.billing_address
                and order.billing_address != order.shipping_address
                else None
            ),
            shipping_ttc=round(
                (order.shipping_ht_cents + order.shipping_vat_cents) / 100, 2
            ),
            total_ttc=round(order.total_ttc_cents / 100, 2),
            order_url=f"{_site_url()}/commandes/{order.order_number}",
            site_url=_site_url(),
        )
    )


def send_garage_order_notification(order: Order, user: User) -> None:
    """Notifie le garage partenaire qu'une commande lui est destinée.

    Le garage voit les pneus à monter et les coordonnées du client, mais
    JAMAIS les prix de vente (règle métier)."""
    garage = order.garage_snapshot or {}
    to = garage.get("email")
    if not to:
        return  # garage sans email : rien à envoyer
    mailer = get_mailer()
    items_view = [
        {"label": it.label_snapshot, "qty": it.quantity}
        for it in order.items
    ]
    customer_name = (
        " ".join(p for p in [user.first_name, user.last_name] if p)
        or user.email
    )
    fire_and_forget(
        mailer.send_template(
            to=to,
            subject=f"Nouvelle commande à monter — {order.order_number}",
            template="garage_new_order.html",
            garage_name=garage.get("name", ""),
            order_number=order.order_number,
            customer_name=customer_name,
            customer_phone=user.phone,
            items=items_view,
            # Vide si le client n'a pas réservé de créneau : le garage
            # lit alors la consigne « contactez le client ».
            appointment_label=appointment_label(order),
            site_url=_site_url(),
        )
    )


def send_admin_new_garage(garage, sirene: dict | None = None) -> None:
    """Notifie l'équipe qu'un nouveau garage partenaire attend validation."""
    to = settings.admin_email or settings.smtp_sender
    if not to:
        return
    sirene = sirene or {}
    if not sirene.get("checked"):
        siret_status = "non vérifié (Sirene indisponible)"
    elif not sirene.get("exists"):
        siret_status = "⚠ INTROUVABLE dans la base Sirene"
    elif not sirene.get("active"):
        siret_status = "⚠ établissement fermé (Sirene)"
    else:
        siret_status = "vérifié — actif (Sirene)"
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=to,
            subject=f"Nouveau garage partenaire à valider — {garage.name}",
            template="admin_new_garage.html",
            garage_name=garage.name,
            siret=garage.siret or "—",
            siret_status=siret_status,
            sirene_name=sirene.get("name") or "—",
            address=f"{garage.address}, {garage.postal_code} {garage.city}",
            email=garage.email or "—",
            phone=garage.phone or "—",
            has_kbis="oui" if garage.kbis_path else "non",
            admin_url=f"{_site_url()}/admin/garages",
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


# ─────────────────────────────────────────────────────────────────
# Rendez-vous de montage
# ─────────────────────────────────────────────────────────────────

def appointment_label(order: Order) -> str:
    """« vendredi 21 août 2026 à 10h30 », en heure locale du garage."""
    from app.modules.garage.booking import PARIS

    if order.mounting_at is None:
        return ""
    at = order.mounting_at.astimezone(PARIS)
    jours = [
        "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
    ]
    mois = [
        "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre",
    ]
    # strftime dépend de la locale du conteneur (souvent C) : on formate
    # à la main pour que l'email soit en français partout.
    return (
        f"{jours[at.weekday()]} {at.day} {mois[at.month - 1]} {at.year} "
        f"à {at.hour}h{at.minute:02d}"
    )


def _appointment_context(order: Order, user: User) -> dict:
    garage = order.garage_snapshot or {}
    return {
        "civilite": _civilite(user),
        "order_number": order.order_number,
        "order_url": f"{_site_url()}/commandes/{order.order_number}",
        "site_url": _site_url(),
        "appointment_label": appointment_label(order),
        "garage_name": garage.get("name", ""),
        "garage_address": garage.get("address", ""),
        "garage_postal_code": garage.get("postal_code", ""),
        "garage_city": garage.get("city", ""),
        "garage_phone": garage.get("phone"),
    }


def send_appointment_confirmed(order: Order, user: User) -> None:
    """Confirme au client le créneau de montage qu'il vient de réserver.

    Envoyé à la commande ET à chaque déplacement : le dernier email reçu
    porte toujours la date qui fait foi.
    """
    if order.mounting_at is None:
        return
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Rendez-vous de montage confirmé — {order.order_number}",
            template="appointment_confirmed.html",
            **_appointment_context(order, user),
        )
    )


def send_appointment_reminder(order: Order, user: User) -> None:
    """Rappel la veille du montage. Le no-show est le premier coût d'un
    planning en ligne : mieux vaut un email de trop qu'un pont vide."""
    if order.mounting_at is None:
        return
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Rappel : montage demain — {order.order_number}",
            template="appointment_reminder.html",
            **_appointment_context(order, user),
        )
    )


def send_appointment_at_risk(order: Order, user: User) -> None:
    """Prévient le client que ses pneus ne sont pas encore expédiés alors
    que son rendez-vous approche. On le dit AVANT qu'il se déplace."""
    if order.mounting_at is None:
        return
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Votre rendez-vous du {appointment_label(order)} est à confirmer",
            template="appointment_at_risk.html",
            **_appointment_context(order, user),
        )
    )


def send_appointment_changed_to_garage(
    order: Order, user: User, previous_label: str
) -> None:
    """Prévient le garage qu'un client a déplacé ou annulé son créneau.

    Sans cet email, le garage découvre le changement en rouvrant son
    planning — c'est-à-dire trop tard.
    """
    garage = order.garage_snapshot or {}
    to = garage.get("email")
    if not to:
        return
    cancelled = order.mounting_at is None
    customer_name = (
        " ".join(p for p in [user.first_name, user.last_name] if p) or user.email
    )
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=to,
            subject=(
                f"Rendez-vous annulé — {order.order_number}"
                if cancelled
                else f"Rendez-vous déplacé — {order.order_number}"
            ),
            template="appointment_changed_garage.html",
            headline=(
                "Un rendez-vous vient d'être annulé"
                if cancelled
                else "Un rendez-vous vient d'être déplacé"
            ),
            garage_name=garage.get("name", ""),
            order_number=order.order_number,
            previous_label=previous_label,
            new_label=(
                "Annulé — le créneau est de nouveau libre"
                if cancelled
                else appointment_label(order)
            ),
            customer_name=customer_name,
            customer_phone=user.phone,
            partner_url=f"{_site_url()}/partenaire",
            site_url=_site_url(),
        )
    )


# ─────────────────────────────────────────────────────────────────
# Sollicitation d'avis
# ─────────────────────────────────────────────────────────────────

def send_review_request(order: Order, user: User, garage_slug: str) -> None:
    """Demande un avis quelques jours après la livraison.

    Un avis ne se demande qu'une fois, et jamais le jour même : le
    client vient de recevoir ses pneus, il ne les a pas encore fait
    monter. Le lien pointe directement sur le formulaire de la fiche
    garage — l'avis porte sur le prestataire, pas sur la commande.
    """
    garage = order.garage_snapshot or {}
    mailer = get_mailer()
    fire_and_forget(
        mailer.send_template(
            to=user.email,
            subject=f"Comment s'est passé votre passage chez {garage.get('name', 'notre partenaire')} ?",
            template="review_request.html",
            civilite=_civilite(user),
            order_number=order.order_number,
            garage_name=garage.get("name", ""),
            garage_city=garage.get("city", ""),
            review_url=f"{_site_url()}/garages/{garage_slug}#avis",
            order_url=f"{_site_url()}/commandes/{order.order_number}",
            site_url=_site_url(),
        )
    )
