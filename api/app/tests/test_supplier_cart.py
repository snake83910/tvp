"""
Tests de la transmission au panier fournisseur.

Chaque commande payée était ressaisie à la main sur le site Maxityre.
L'automatiser supprime la faute de frappe qui envoie les mauvais pneus,
mais introduit une décision que personne ne prenait explicitement :
**quelle offre acheter**.

C'est là que portent les tests. Le choix engage deux promesses faites au
client — la marge, et la date de livraison sur laquelle son rendez-vous
de montage est calé.

Lancer : pytest app/tests/test_supplier_cart.py
"""
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.modules.orders import supplier_cart as sc

PROMIS = date(2026, 8, 20)


def offre(**kw):
    base = dict(
        offerId=1, hash="h1", supplierId=952, stock=40,
        prixHt=29.34, supHtOne=0.0, dateDelivery="2026-08-19T23:00:11+02:00",
    )
    base.update(kw)
    return base


# ── Choix de l'offre ──────────────────────────────────────────────

def test_stock_insuffisant_ecarte():
    """Commander 4 pneus chez un vendeur qui en a 2, c'est une commande
    qui bloquera — mieux vaut le voir tout de suite."""
    o, _ = sc.pick_offer([offre(stock=2)], quantity=4)
    assert o is None


def test_moins_chere_parmi_celles_qui_tiennent_la_date():
    chere = offre(offerId=1, prixHt=40.0)
    pas_chere = offre(offerId=2, prixHt=29.0)
    o, retard = sc.pick_offer([chere, pas_chere], 2, PROMIS)
    assert o["offerId"] == 2
    assert retard is False


def test_supplement_unitaire_compte_dans_le_prix():
    """`supHtOne` est un supplément par pneu : l'ignorer ferait passer
    pour moins chère une offre qui ne l'est pas."""
    apparente = offre(offerId=1, prixHt=29.0, supHtOne=8.0)   # 37,00 réel
    reelle = offre(offerId=2, prixHt=32.0, supHtOne=0.0)      # 32,00 réel
    o, _ = sc.pick_offer([apparente, reelle], 2, PROMIS)
    assert o["offerId"] == 2


def test_une_offre_moins_chere_mais_en_retard_est_ecartee():
    """LE test qui protège les rendez-vous de montage : ils sont calés
    sur la date annoncée. Économiser deux euros en livrant après le
    rendez-vous envoie un client devant un pont vide."""
    tardive = offre(offerId=1, prixHt=20.0, dateDelivery="2026-08-28T10:00:00+02:00")
    a_temps = offre(offerId=2, prixHt=32.0, dateDelivery="2026-08-19T10:00:00+02:00")

    o, retard = sc.pick_offer([tardive, a_temps], 2, PROMIS)
    assert o["offerId"] == 2
    assert retard is False


def test_aucune_offre_a_temps_on_prend_la_plus_rapide_et_on_le_signale():
    """Le retard est inévitable : on choisit le moindre, et surtout on
    le REMONTE — un glissement silencieux se découvre par un client."""
    lente = offre(offerId=1, prixHt=20.0, dateDelivery="2026-09-05T10:00:00+02:00")
    moins_lente = offre(offerId=2, prixHt=35.0, dateDelivery="2026-08-25T10:00:00+02:00")

    o, retard = sc.pick_offer([lente, moins_lente], 2, PROMIS)
    assert o["offerId"] == 2
    assert retard is True


def test_sans_date_promise_le_prix_decide():
    o, retard = sc.pick_offer(
        [offre(offerId=1, prixHt=40.0), offre(offerId=2, prixHt=29.0)], 2, None
    )
    assert o["offerId"] == 2
    assert retard is False


def test_offre_sans_identifiant_ignoree():
    """Sans `offerId` ni `hash`, la ligne serait refusée par le
    fournisseur : autant ne pas la retenir."""
    assert sc.pick_offer([offre(offerId=None)], 2)[0] is None
    assert sc.pick_offer([offre(hash=None)], 2)[0] is None


# ── Composition des lignes ────────────────────────────────────────

def _order(**kw):
    base = dict(id="o1", delivery_estimate=PROMIS, total_ht_cents=9980)
    base.update(kw)
    return SimpleNamespace(**base)


def _item(ref="1941196", qty=2, prix_ht_cents=4990):
    return SimpleNamespace(
        supplier_ref=ref,
        label_snapshot="Praxent Excelander PH08 205/55 R16 91V",
        quantity=qty,
        unit_price_ht_cents=prix_ht_cents,
    )


@pytest.mark.asyncio
async def test_ligne_construite_au_format_du_fournisseur():
    connector = SimpleNamespace(
        get_offers=AsyncMock(return_value=[offre()])
    )
    lines, rapport = await sc.build_lines(connector, _order(), [_item()])

    assert lines == [{
        "supplier": 952,
        "hash": "h1",
        "productId": 1941196,
        "type": "tyre",
        "quantity": 2,
        "offerId": 1,
    }]
    # Le prix d'ACHAT du jour accompagne la ligne : c'est le seul moment
    # où la marge réelle d'une commande est vérifiable.
    assert rapport[0]["buy_price_ht"] == 29.34
    assert rapport[0]["sell_price_ht"] == 49.90


@pytest.mark.asyncio
async def test_article_introuvable_signale_sans_bloquer_les_autres():
    """Une référence disparue ne doit pas empêcher de commander le
    reste : l'admin complètera à la main ce qui manque."""
    async def offers(ref):
        return [] if ref == "999" else [offre()]

    connector = SimpleNamespace(get_offers=offers)
    lines, rapport = await sc.build_lines(
        connector, _order(), [_item(ref="999"), _item(ref="1941196")]
    )

    assert len(lines) == 1
    assert rapport[0]["ok"] is False
    assert "stock" in rapport[0]["error"]
    assert rapport[1]["ok"] is True


@pytest.mark.asyncio
async def test_fournisseur_muet_sur_un_article():
    connector = SimpleNamespace(
        get_offers=AsyncMock(side_effect=RuntimeError("timeout"))
    )
    lines, rapport = await sc.build_lines(connector, _order(), [_item()])

    assert lines == []
    assert rapport[0]["ok"] is False
    assert "RuntimeError" in rapport[0]["error"]


@pytest.mark.asyncio
async def test_rien_a_envoyer_ne_touche_pas_la_commande():
    """Même règle que pour les remboursements : pas de trace de
    transmission si rien n'a été transmis."""
    from unittest.mock import patch

    order = _order()
    order.supplier_pushed_at = None
    db = AsyncMock()
    db.scalars = AsyncMock(return_value=SimpleNamespace(all=lambda: [_item()]))

    with patch.object(sc, "build_lines", AsyncMock(return_value=([], [
        {"ref": "1", "ok": False, "error": "Aucune offre"}
    ]))), patch("app.core.config.settings.supplier_provider", "maxityre"):
        with pytest.raises(sc.SupplierCartError, match="Aucun article"):
            await sc.push_order(db, order)

    assert order.supplier_pushed_at is None


# ── Adresse de livraison ──────────────────────────────────────────

def _cmd_domicile():
    return SimpleNamespace(
        delivery_mode="home",
        garage_snapshot={},
        shipping_address={
            "line1": "17 Rue Ambroise Croizat", "line2": None,
            # Pas de téléphone : les snapshots de commande n'en portent
            # pas, il vit sur le compte client (`_address_snapshot` ne
            # copie que label, lignes, code postal, ville, pays).
            "postal_code": "83560", "city": "Rians", "country": "FR",
        },
    )


def _cmd_garage():
    return SimpleNamespace(
        delivery_mode="partner_garage",
        garage_snapshot={
            "name": "Garage Rivaz", "address": "12 avenue du Garage",
            "postal_code": "69003", "city": "Lyon", "phone": "0478000000",
        },
        shipping_address={"line1": "chez le client", "postal_code": "13100",
                          "city": "Aix", "country": "FR"},
    )


def test_montage_en_garage_livre_au_garage():
    """LE piège du dropshipping : pour un montage, le destinataire est
    le GARAGE. Livrer chez le client enverrait les pneus à quelqu'un qui
    n'attend rien et ne pourra pas les monter."""
    a = sc.build_address(_cmd_garage())
    assert a["name"] == "Garage Rivaz"
    assert a["city"] == "Lyon"
    assert a["postalCode"] == "69003"


def test_livraison_domicile_utilise_ladresse_du_client():
    a = sc.build_address(_cmd_domicile())
    assert a["street"] == "17 Rue Ambroise Croizat"
    assert a["postalCode"] == "83560"


@pytest.mark.asyncio
async def test_telephone_obligatoire(_email_site):
    """Les adresses figées ne portent PAS de téléphone : il vient du
    compte. Sans lui le fournisseur refuse l'adresse par un 400 nu —
    autant l'arrêter ici, avec un message qui nomme le champ."""
    connector = SimpleNamespace(
        list_addresses=AsyncMock(), create_address=AsyncMock()
    )
    with pytest.raises(sc.SupplierCartError, match="téléphone"):
        await sc.ensure_address(connector, _cmd_domicile(), "Simon Rémy")

    connector.create_address.assert_not_awaited()


@pytest.mark.asyncio
async def test_telephone_du_compte_normalise(_email_site):
    connector = SimpleNamespace(
        list_addresses=AsyncMock(return_value=[]),
        create_address=AsyncMock(return_value={"id": 7}),
    )
    await sc.ensure_address(
        connector, _cmd_domicile(), "Simon Rémy", "07 71 87 81 98"
    )
    envoye = connector.create_address.await_args.args[0]
    assert envoye["phone"] == {"country": "FR", "number": "0771878198"}


def test_complement_dadresse_conserve():
    """Un « Bâtiment C » perdu, c'est un colis qui revient."""
    cmd = _cmd_domicile()
    cmd.shipping_address["line2"] = "Bâtiment C"
    assert "Bâtiment C" in sc.build_address(cmd)["street"]


def test_email_du_site_jamais_celui_du_client(monkeypatch):
    """Les avis d'expédition doivent nous revenir, et le fournisseur n'a
    pas à récupérer le fichier client."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_email", "service@tousvospneus.com")
    a = sc.build_address(_cmd_domicile())
    assert a["mail"] == "service@tousvospneus.com"


@pytest.mark.asyncio
async def test_email_du_site_absent_bloque_la_creation():
    """ADMIN_EMAIL et SMTP_SENDER vides : créer une adresse sans contact
    priverait des avis d'expédition, et se découvrirait au premier colis
    perdu."""
    connector = SimpleNamespace(
        list_addresses=AsyncMock(), create_address=AsyncMock()
    )
    with pytest.raises(sc.SupplierCartError, match="mail"):
        await sc.ensure_address(connector, _cmd_domicile(), "Simon Rémy")

    connector.create_address.assert_not_awaited()


def test_doublons_reconnus_malgre_casse_et_espaces():
    """Le carnet mélange « FUVEAU » et « fuveau » : sans normalisation,
    un client qui recommande empilerait des adresses identiques."""
    a = {"name": "Simon Rémy", "street": "17 Rue Ambroise Croizat",
         "postalCode": "83560", "city": "Rians"}
    b = {"name": "simon  rémy", "street": "17 rue ambroise croizat",
         "postalCode": "83 560", "city": "RIANS"}
    assert sc.address_key(a) == sc.address_key(b)

    autre = {**a, "street": "18 Rue Ambroise Croizat"}
    assert sc.address_key(a) != sc.address_key(autre)


@pytest.fixture
def _email_site(monkeypatch):
    """Le serveur a une adresse de contact configurée (cas nominal)."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "admin_email", "service@tousvospneus.com")


@pytest.mark.asyncio
async def test_adresse_existante_reutilisee_sans_creation(_email_site):
    existante = {
        "id": 696430, "name": "Simon Rémy",
        "street": "17 Rue Ambroise Croizat",
        "postalCode": "83560", "city": "Rians",
    }
    connector = SimpleNamespace(
        list_addresses=AsyncMock(return_value=[existante]),
        create_address=AsyncMock(),
    )
    res = await sc.ensure_address(
        connector, _cmd_domicile(), "Simon Rémy", "0771878198"
    )

    assert res == {"id": 696430, "created": False,
                   "name": "Simon Rémy", "city": "Rians"}
    connector.create_address.assert_not_awaited()


@pytest.mark.asyncio
async def test_adresse_absente_creee(_email_site):
    connector = SimpleNamespace(
        list_addresses=AsyncMock(return_value=[]),
        create_address=AsyncMock(return_value={"id": 999, "name": "Simon Rémy",
                                               "city": "Rians"}),
    )
    res = await sc.ensure_address(
        connector, _cmd_domicile(), "Simon Rémy", "0771878198"
    )
    assert res["id"] == 999
    assert res["created"] is True


@pytest.mark.asyncio
async def test_adresse_incomplete_refusee_avant_tout_appel(_email_site):
    """Mieux vaut refuser que créer une adresse sans destinataire : le
    transporteur ne saurait pas à qui remettre le colis."""
    connector = SimpleNamespace(
        list_addresses=AsyncMock(), create_address=AsyncMock()
    )
    with pytest.raises(sc.SupplierCartError, match="incomplète"):
        await sc.ensure_address(connector, _cmd_domicile(), "")

    connector.create_address.assert_not_awaited()
