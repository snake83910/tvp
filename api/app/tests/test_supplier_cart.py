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
