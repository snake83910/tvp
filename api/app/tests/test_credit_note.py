"""
Tests de la facture d'avoir.

Une facture émise ne se modifie ni ne s'annule : un remboursement se
matérialise par une facture rectificative qui référence l'originale et
porte la TVA à régulariser (art. 289 et 272 du CGI). Sans avoir, la TVA
collectée sur la vente reste due — c'est un coût sec, pas un détail de
présentation.

Deux exigences comptables sont testées ici :

  * un avoir TOTAL doit rendre EXACTEMENT les montants de la facture,
    au centime. Un écart d'arrondi entre une facture et son avoir est un
    centime que personne ne saura justifier ;
  * un avoir PARTIEL doit ventiler HT et TVA de façon cohérente, et ses
    deux composantes doivent sommer au montant réellement rendu.

Lancer : pytest app/tests/test_credit_note.py
"""
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.modules.orders.invoice import (
    credit_note_ref,
    generate_credit_note_pdf,
    invoice_ref,
    split_refund_vat,
)

TOTAL_TTC = 11976
TOTAL_HT = 9980
TOTAL_VAT = 1996


def _item():
    return SimpleNamespace(
        supplier_ref="9920555164",
        label_snapshot="Banc BC-Eco 205/55 R16",
        quantity=2,
        unit_price_ht_cents=4990,
        vat_rate=20.0,
    )


def _order(**kw):
    base = dict(
        id=uuid.uuid4(),
        order_number="CMD-2026-000088",
        invoice_number=14,
        credit_note_number=1,
        created_at=datetime(2026, 8, 10, tzinfo=UTC),
        paid_at=datetime(2026, 8, 10, tzinfo=UTC),
        refunded_at=datetime(2026, 8, 16, tzinfo=UTC),
        refunded_cents=TOTAL_TTC,
        total_ttc_cents=TOTAL_TTC,
        total_ht_cents=TOTAL_HT,
        total_vat_cents=TOTAL_VAT,
        shipping_ht_cents=0,
        shipping_vat_cents=0,
        discount_ttc_cents=0,
        promo_code=None,
        delivery_mode="home",
        shipping_address={
            "line1": "8 rue des Verifications",
            "postal_code": "13100",
            "city": "Aix-en-Provence",
            "country": "FR",
        },
        billing_address=None,
        items=[_item()],
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _user():
    return SimpleNamespace(
        first_name="Camille", last_name="Durand", email="client@example.com"
    )


# ── Références ────────────────────────────────────────────────────

def test_serie_dediee_av():
    """Série distincte des factures : deux compteurs, mais des pièces
    qu'on ne confond jamais."""
    assert credit_note_ref(_order()) == "AV-2026-000001"
    assert invoice_ref(_order()) == "FAC-2026-000014"


def test_millesime_pris_sur_la_date_de_remboursement():
    """Un remboursement de janvier sur une vente de décembre appartient
    au nouvel exercice."""
    o = _order(
        created_at=datetime(2025, 12, 20, tzinfo=UTC),
        paid_at=datetime(2025, 12, 20, tzinfo=UTC),
        refunded_at=datetime(2026, 1, 5, tzinfo=UTC),
    )
    assert credit_note_ref(o) == "AV-2026-000001"
    # La facture, elle, garde son millésime d'origine.
    assert invoice_ref(o) == "FAC-2025-000014"


def test_pas_de_reference_sans_numero():
    assert credit_note_ref(_order(credit_note_number=None)) is None
    assert invoice_ref(_order(invoice_number=None)) is None


# ── Ventilation HT / TVA ──────────────────────────────────────────

def test_avoir_total_reprend_les_montants_exacts():
    """Recalculer introduirait un écart d'arrondi avec la facture."""
    ht, vat = split_refund_vat(_order(), TOTAL_TTC)
    assert (ht, vat) == (TOTAL_HT, TOTAL_VAT)
    assert ht + vat == TOTAL_TTC


def test_avoir_partiel_somme_au_montant_rendu():
    """La règle qui compte : quelle que soit la ventilation, HT + TVA
    doit valoir exactement ce qui a quitté le compte."""
    for montant in (1, 999, 5000, 6789, TOTAL_TTC - 1):
        ht, vat = split_refund_vat(_order(), montant)
        assert ht + vat == montant, f"{montant} centimes mal ventilés"
        assert vat >= 0


def test_avoir_partiel_applique_le_taux_de_la_commande():
    ht, vat = split_refund_vat(_order(), 5000)
    # 50,00 EUR TTC à 20 % -> 41,67 HT + 8,33 TVA
    assert (ht, vat) == (4167, 833)


def test_commande_sans_ht_ne_casse_pas():
    """Cas dégradé (commande à 0 HT) : pas de division par zéro."""
    o = _order(total_ht_cents=0, total_vat_cents=0, total_ttc_cents=0)
    assert split_refund_vat(o, 500) == (500, 0)


# ── Document ──────────────────────────────────────────────────────

def _texte(pdf: bytes) -> str:
    import re
    import zlib

    morceaux = []
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        try:
            morceaux.append(zlib.decompress(m.group(1)).decode("latin-1"))
        except Exception:
            pass
    return " ".join(re.findall(r"\(([^)]*)\)", " ".join(morceaux)))


def test_avoir_total_porte_les_mentions_obligatoires():
    contenu = _texte(generate_credit_note_pdf(_order(), _user()))

    assert "FACTURE D'AVOIR" in contenu
    assert "AV-2026-000001" in contenu
    # La référence à la facture d'origine est ce qui en fait une facture
    # RECTIFICATIVE et non une seconde vente.
    assert "FAC-2026-000014" in contenu
    assert "289" in contenu           # base légale
    assert "-119.76 EUR" in contenu   # total en négatif
    assert "-19.96 EUR" in contenu    # TVA à régulariser
    assert "Camille Durand" in contenu


def test_avoir_partiel_ne_detaille_pas_les_articles():
    """On rembourse une SOMME, pas des lignes : lister les articles
    laisserait croire à un retour produit qui n'a pas eu lieu."""
    contenu = _texte(
        generate_credit_note_pdf(_order(refunded_cents=5000), _user())
    )

    assert "Remboursement partiel" in contenu
    assert "-50.00 EUR" in contenu
    assert "-8.33 EUR" in contenu
    assert "Banc BC-Eco" not in contenu
    # Le total d'origine reste rappelé, pour situer l'avoir.
    assert "119.76 EUR" in contenu


def test_pas_d_avoir_sans_numero():
    """Produire un document hors série serait fabriquer une pièce
    comptable fantôme."""
    with pytest.raises(ValueError):
        generate_credit_note_pdf(_order(credit_note_number=None), _user())
    with pytest.raises(ValueError):
        generate_credit_note_pdf(_order(refunded_cents=None), _user())
