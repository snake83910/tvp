"""
Adresse email confirmée avant de payer, pour un compte invité.

Ce qui est en jeu : tout ce qui suit la commande passe par l'email —
confirmation, facture, numéro de suivi, et le remboursement s'il y a
litige. Une faute de frappe au checkout, et on livre un client qu'on ne
sait plus joindre, avec de l'argent encaissé.

La porte est côté serveur et pas seulement dans le navigateur : la page
de paiement présente le code, mais rien n'empêche d'appeler /payment/init
directement. C'est ce que vérifie ce fichier.

Elle ne s'applique QU'AUX comptes nés du tunnel invité. Un client inscrit
a déjà reçu son code à l'inscription ; l'arrêter devant sa carte
coûterait une vente sans rien prouver de plus.

Lancer : pytest app/tests/test_payment_email_gate.py
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.errors import AppError, ErrorCode
from app.models.order import OrderStatus
from app.modules.orders.payment_router import init_payment


def _order(user_id: uuid.UUID):
    order = MagicMock()
    order.id = uuid.uuid4()
    order.user_id = user_id
    order.order_number = "CMD-2026-000001"
    order.status = OrderStatus.pending_payment
    order.total_ttc_cents = 11976
    order.account_type_snapshot = "particulier"
    return order


def _user(*, is_guest: bool, verified: bool):
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "camille@example.com"
    user.is_guest = is_guest
    user.email_verified = verified
    return user


async def _porte_fermee(user) -> bool:
    """Vrai si la porte a refusé le paiement pour email non confirmé.

    On ne peut pas laisser `init_payment` aller jusqu'au bout : il
    appelle la banque. Tout échec AUTRE que ce refus signifie donc que
    la porte a laissé passer — et c'est précisément ce qu'on veut
    distinguer, plutôt que de dépendre de l'exception qui survient
    ensuite.
    """
    db = MagicMock()
    db.scalar = AsyncMock(return_value=_order(user.id))
    try:
        await init_payment("CMD-2026-000001", db=db, user=user)
    except AppError as e:
        return e.code == ErrorCode.EMAIL_NOT_VERIFIED
    except Exception:
        return False
    return False


async def test_invite_non_verifie_refuse():
    """403 portant un code stable : c'est lui qui dit au navigateur
    d'afficher la saisie du code plutôt qu'un message d'échec."""
    user = _user(is_guest=True, verified=False)
    db = MagicMock()
    db.scalar = AsyncMock(return_value=_order(user.id))

    with pytest.raises(AppError) as exc:
        await init_payment("CMD-2026-000001", db=db, user=user)

    assert exc.value.status_code == 403
    assert exc.value.code == ErrorCode.EMAIL_NOT_VERIFIED


async def test_invite_verifie_passe():
    """Le code a été saisi : plus rien ne distingue ce client d'un autre."""
    assert await _porte_fermee(_user(is_guest=True, verified=True)) is False


async def test_client_inscrit_non_verifie_passe():
    """La règle vise l'origine du compte, pas l'état de vérification.

    Les comptes inscrits d'avant cette fonctionnalité sont tous « non
    vérifiés » : les bloquer aurait coupé le paiement à toute la base
    existante, du jour au lendemain.
    """
    assert await _porte_fermee(_user(is_guest=False, verified=False)) is False


async def test_porte_posee_apres_le_controle_de_proprietaire():
    """Une commande qui n'est pas la sienne reste un 404, jamais un 403.

    L'ordre importe : répondre « confirmez votre email » sur la commande
    d'un tiers confirmerait qu'elle existe.
    """
    user = _user(is_guest=True, verified=False)
    autre = _order(uuid.uuid4())  # appartient à quelqu'un d'autre
    db = MagicMock()
    db.scalar = AsyncMock(return_value=autre)

    with pytest.raises(Exception) as exc:
        await init_payment("CMD-2026-000001", db=db, user=user)

    assert exc.value.status_code == 404
