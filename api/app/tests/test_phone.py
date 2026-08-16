"""
Tests de la normalisation des numéros de téléphone.

Ces numéros ne sont plus décoratifs : ce sont eux qui partent chez le
fournisseur avec l'adresse de livraison. Un numéro absent fait refuser
l'adresse (vécu : un « 400 Bad Request » muet), un numéro mal formé
fait échouer la livraison — ce qui coûte bien plus cher.

Deux exigences opposées à tenir ensemble : accepter ce que les gens
tapent réellement, et ne stocker qu'une seule forme.

Lancer : pytest app/tests/test_phone.py
"""
import pytest

from app.core.phone import format_fr, normalize_fr


@pytest.mark.parametrize(
    "saisie",
    [
        "0611223344",
        "06 11 22 33 44",
        "06.11.22.33.44",
        "06-11-22-33-44",
        " 06 11 22 33 44 ",
        "+33 6 11 22 33 44",
        "+33611223344",
        "0033611223344",
    ],
)
def test_formes_usuelles_acceptees(saisie):
    """Refuser une saisie sur une question de présentation ferait échouer
    des inscriptions parfaitement légitimes."""
    assert normalize_fr(saisie) == "0611223344"


@pytest.mark.parametrize(
    "prefixe", ["01", "02", "03", "04", "05", "06", "07", "09"]
)
def test_prefixes_valides(prefixe):
    assert normalize_fr(f"{prefixe}11223344") == f"{prefixe}11223344"


def test_numero_surtaxe_refuse():
    """08 : numéro spécial surtaxé. Un transporteur ne peut pas
    l'appeler pour prévenir d'une livraison."""
    assert normalize_fr("0811223344") is None


@pytest.mark.parametrize(
    "saisie",
    [
        None, "", "   ",
        "06112233",          # trop court
        "061122334455",      # trop long
        "0011223344",        # préfixe inexistant
        "téléphone",
        "+44 20 7946 0958",  # étranger : hors périmètre pour l'instant
    ],
)
def test_saisies_inexploitables_refusees(saisie):
    assert normalize_fr(saisie) is None


def test_forme_canonique_unique():
    """Toutes les écritures d'un même numéro doivent converger : sans
    ça, le dédoublonnage des adresses fournisseur échouerait."""
    formes = {"06 11 22 33 44", "+33611223344", "06.11.22.33.44"}
    assert len({normalize_fr(f) for f in formes}) == 1


def test_affichage_lisible():
    assert format_fr("0611223344") == "06 11 22 33 44"
    # Valeur inattendue : rendue telle quelle plutôt que tronquée.
    assert format_fr("123") == "123"
    assert format_fr(None) == ""


# ── Intégration dans les schémas d'entrée ─────────────────────────

def test_inscription_exige_un_telephone():
    from pydantic import ValidationError

    from app.schemas.auth import RegisterIn

    with pytest.raises(ValidationError):
        RegisterIn(email="a@b.fr", password="motdepasse1")


def test_inscription_normalise_le_telephone():
    from app.schemas.auth import RegisterIn

    data = RegisterIn(
        email="a@b.fr", password="motdepasse1", phone="+33 6 11 22 33 44"
    )
    assert data.phone == "0611223344"


def test_checkout_invite_exige_un_telephone():
    """Le tunnel invité est le plus gros pourvoyeur de commandes : sans
    téléphone, leur adresse serait refusée par le fournisseur."""
    from pydantic import ValidationError

    from app.schemas.auth import AddressIn
    from app.schemas.order import GuestCheckoutIn

    adresse = AddressIn(
        line1="8 rue des Vérifications", postal_code="13100",
        city="Aix-en-Provence", country="FR",
    )
    with pytest.raises(ValidationError):
        GuestCheckoutIn(
            email="a@b.fr", first_name="Camille", last_name="Durand",
            shipping=adresse, accept_terms=True,
        )
