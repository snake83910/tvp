"""
Tests de ce qu'on transmet à la banque au moment du paiement.

Deux enjeux distincts :

* **Exploitabilité.** L'`orderId` envoyé doit être le NUMÉRO de commande
  (CMD-2026-000123), pas l'UUID interne. C'est lui que le client cite
  dans un email et qui figure sur sa facture ; avec un UUID au Back
  Office, rapprocher une transaction contestée demande un aller-retour
  en base.

* **Acceptation.** L'identité et les adresses nourrissent l'analyse de
  risque : une commande anonyme passe moins bien qu'une commande dont
  l'adresse de livraison est cohérente avec le porteur de carte. Mais un
  champ mal formé (pays « France » au lieu de « FR », nom trop long)
  fait échouer TOUT l'appel — donc pas de paiement du tout. Le mapping
  doit tronquer et normaliser plutôt que refuser.

Lancer : pytest app/tests/test_payment_customer.py
"""
import uuid
from types import SimpleNamespace

from app.integrations.payment import (
    BuyerInfo,
    _iso_country,
    _soge_customer,
)
from app.modules.orders.payment_router import _buyer_info

ADRESSE = {
    "label": "Domicile",
    "line1": "8 rue des Vérifications",
    "line2": "Bâtiment C",
    "postal_code": "13100",
    "city": "Aix-en-Provence",
    "country": "FR",
}


def _buyer(**kw) -> BuyerInfo:
    base = dict(
        email="client@example.com",
        reference="user-42",
        first_name="Camille",
        last_name="Durand",
        phone="0611223344",
        billing=ADRESSE,
        shipping=ADRESSE,
    )
    base.update(kw)
    return BuyerInfo(**base)


# ── Normalisation du pays ─────────────────────────────────────────

def test_pays_ramene_au_code_iso():
    """Les commandes portent tantôt « FR », tantôt « France » selon le
    parcours. La banque n'accepte que le code à deux lettres."""
    assert _iso_country("FR") == "FR"
    assert _iso_country("fr") == "FR"
    assert _iso_country("France") == "FR"
    assert _iso_country("Belgique") == "BE"
    assert _iso_country(None) is None
    # Pays inconnu : champ omis plutôt qu'invalide — un champ absent ne
    # fait pas échouer l'appel, un champ refusé oui.
    assert _iso_country("Atlantide") is None


# ── Objet customer ────────────────────────────────────────────────

def test_identite_et_adresses_transmises():
    c = _soge_customer(_buyer(), None)

    assert c["email"] == "client@example.com"
    assert c["reference"] == "user-42"
    b = c["billingDetails"]
    assert b["firstName"] == "Camille"
    assert b["lastName"] == "Durand"
    assert b["phoneNumber"] == "0611223344"
    assert b["zipCode"] == "13100"
    assert b["city"] == "Aix-en-Provence"
    assert b["country"] == "FR"
    assert b["category"] == "PRIVATE"
    assert b["language"] == "fr"
    # Le complément d'adresse n'a pas de champ dédié côté banque : il
    # est concaténé plutôt que perdu, l'adresse doit rester livrable.
    assert "Bâtiment C" in b["address"]


def test_compte_pro_declare_comme_entreprise():
    c = _soge_customer(
        _buyer(is_company=True, company_name="Garage Rivaz SARL"), None
    )
    b = c["billingDetails"]
    assert b["category"] == "COMPANY"
    assert b["legalName"] == "Garage Rivaz SARL"


def test_retrait_garage_signale_a_la_banque():
    """Un écart entre adresse de facturation et lieu de livraison est un
    signal de fraude — sauf s'il s'agit d'un retrait en point de vente,
    encore faut-il le dire."""
    domicile = _soge_customer(_buyer(delivery_mode="home"), None)
    garage = _soge_customer(_buyer(delivery_mode="partner_garage"), None)

    assert domicile["shippingDetails"]["shippingMethod"] == "PACKAGE_DELIVERY_COMPANY"
    assert garage["shippingDetails"]["shippingMethod"] == "RECLAIM_IN_SHOP"


def test_champs_trop_longs_tronques():
    """Un nom à rallonge ne doit pas faire échouer le paiement."""
    c = _soge_customer(
        _buyer(last_name="D" * 200, billing={**ADRESSE, "line1": "R" * 400}),
        None,
    )
    b = c["billingDetails"]
    assert len(b["lastName"]) == 63
    assert len(b["address"]) == 255


def test_champs_vides_omis_plutot_que_vides():
    """Un champ vide compte comme une information fournie côté banque :
    mieux vaut l'absence."""
    c = _soge_customer(
        _buyer(phone="   ", first_name=None, billing=None, shipping=None), None
    )
    b = c["billingDetails"]
    assert "phoneNumber" not in b
    assert "firstName" not in b
    assert "zipCode" not in b


def test_acheteur_inconnu_retombe_sur_l_email():
    """Comportement d'avant la reprise : sans BuyerInfo, on transmet au
    moins l'email pour que le formulaire ne le redemande pas."""
    assert _soge_customer(None, "seul@example.com") == {
        "email": "seul@example.com"
    }
    assert _soge_customer(None, None) == {}


def test_aucune_donnee_aucune_adresse_inventee():
    """Sans la moindre info, on n'envoie pas une adresse réduite à une
    langue ou à un mode de livraison."""
    c = _soge_customer(
        BuyerInfo(email="x@example.com"), None
    )
    assert c == {"email": "x@example.com"}


# ── Construction depuis la commande ───────────────────────────────

def _order(**kw):
    base = dict(
        billing_address={**ADRESSE, "city": "Marseille"},
        shipping_address=ADRESSE,
        delivery_mode="home",
        account_type_snapshot="particulier",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _user():
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="client@example.com",
        first_name="Camille",
        last_name="Durand",
        phone="0611223344",
    )


def test_adresses_prises_sur_la_commande_pas_sur_le_compte():
    """Elles sont figées au checkout : un client qui modifie son carnet
    pendant qu'il paie ne doit pas décaler ce que la banque analyse par
    rapport à ce qui sera réellement livré."""
    order, user = _order(), _user()
    info = _buyer_info(order, user)

    assert info.billing["city"] == "Marseille"
    assert info.shipping["city"] == "Aix-en-Provence"
    assert info.reference == str(user.id)


def test_facturation_absente_retombe_sur_la_livraison():
    order = _order(billing_address=None)
    info = _buyer_info(order, _user())
    assert info.billing == ADRESSE


def test_raison_sociale_seulement_si_fournie():
    order, user = _order(account_type_snapshot="pro"), _user()
    assert _buyer_info(order, user).is_company is False
    assert _buyer_info(order, user, "Garage Rivaz SARL").is_company is True
