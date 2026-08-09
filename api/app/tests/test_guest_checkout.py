"""
Tests du checkout invité.

CRITIQUE : ce parcours crée un compte ET rend une paire de jetons. Si une
adresse email déjà enregistrée était acceptée, il suffirait de saisir
l'adresse d'un tiers au moment de commander pour obtenir une session sur
son compte — donc l'accès à ses commandes, ses adresses et ses factures.
Le refus sur email existant est la garde qui rend le reste du parcours
sûr : elle est testée ici pour qu'aucune refonte ne la retire par
inadvertance.
"""
import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.models.user import AccountType, User, UserRole
from app.modules.auth.service import create_guest_user


def _db_avec_utilisateur(existant: User | None) -> AsyncMock:
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=existant)
    db.add = lambda _obj: None
    db.flush = AsyncMock()
    return db


@pytest.mark.asyncio
async def test_email_deja_enregistre_refuse():
    """Email connu -> 409, aucun compte créé, aucun jeton émis."""
    deja = User(
        id=uuid.uuid4(),
        email="victime@example.com",
        password_hash="x",
        account_type=AccountType.particulier,
        role=UserRole.client,
    )
    db = _db_avec_utilisateur(deja)

    with pytest.raises(HTTPException) as exc:
        await create_guest_user(db, "victime@example.com", "Pirate", "Malveillant")

    assert exc.value.status_code == 409
    db.flush.assert_not_awaited()


@pytest.mark.asyncio
async def test_email_inconnu_cree_un_compte_client():
    """Email libre -> compte particulier/client, email non vérifié."""
    db = _db_avec_utilisateur(None)

    user = await create_guest_user(db, "nouveau@example.com", "Jean", "Dupont", "0600000000")

    assert user.email == "nouveau@example.com"
    assert user.account_type == AccountType.particulier
    assert user.role == UserRole.client
    # L'adresse n'est pas prouvée à cet instant : la marquer vérifiée
    # ferait passer pour confirmée une adresse simplement saisie.
    assert user.email_verified is False
    db.flush.assert_awaited()


@pytest.mark.asyncio
async def test_mot_de_passe_non_devinable():
    """Le compte invité ne doit pas être connectable par mot de passe.

    On ne stocke pas de valeur fixe ni vide : deux comptes invités créés
    de suite doivent avoir des empreintes différentes, sinon un mot de
    passe « invité » commun ouvrirait tous ces comptes d'un coup.
    """
    a = await create_guest_user(_db_avec_utilisateur(None), "a@example.com", "A", "A")
    b = await create_guest_user(_db_avec_utilisateur(None), "b@example.com", "B", "B")

    assert a.password_hash and b.password_hash
    assert a.password_hash != b.password_hash
