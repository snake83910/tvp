"""
Barème de frais de port par famille de véhicule (validé juillet 2026).

  auto / quad     : 6,90 € HT si une ligne < 2 pneus, sinon gratuit
  camion/agricole : 15,00 € HT si une ligne < 2 pneus, sinon gratuit
  moto            : toujours gratuit

Les forfaits S'ADDITIONNENT par ligne en défaut, y compris au sein
d'une même famille (1 Michelin + 1 Continental auto = 2 x 6,90 €).
"""
from app.modules.shipping.rules import compute_home_shipping


def _ht(lines):
    return compute_home_shipping(lines).ht_cents


def test_auto_2_pneus_gratuit():
    assert _ht([("auto", 2)]) == 0


def test_auto_1_pneu_690():
    q = compute_home_shipping([("auto", 1)])
    assert q.ht_cents == 690
    assert q.vat_cents == 138          # 20 % TVA
    assert q.ttc_cents == 828


def test_quad_1_pneu_690():
    assert _ht([("quad", 1)]) == 690


def test_camion_1_pneu_1500():
    assert _ht([("camion", 1)]) == 1500


def test_agricole_1_pneu_1500():
    assert _ht([("agricole", 1)]) == 1500


def test_camion_2_pneus_gratuit():
    assert _ht([("camion", 2)]) == 0


def test_moto_toujours_gratuit():
    assert _ht([("moto", 1)]) == 0
    assert _ht([("moto", 1), ("moto", 1)]) == 0


def test_mixte_somme_des_forfaits():
    # 1 auto (6,90) + 1 camion (15,00) -> 21,90 (une expédition par ligne)
    assert _ht([("auto", 1), ("camion", 1)]) == 2190


def test_meme_famille_somme_aussi():
    # 1 Michelin + 1 Continental auto -> 2 x 6,90 = 13,80
    assert _ht([("auto", 1), ("auto", 1)]) == 1380


def test_ligne_a_2_ne_paie_pas_dans_un_mixte():
    # La ligne camion à 2 pneus est gratuite, seule la ligne auto paie
    assert _ht([("auto", 1), ("camion", 2)]) == 690


def test_mixte_moto_ne_couvre_pas_l_auto():
    # La moto est gratuite mais la ligne auto seule paie son forfait
    assert _ht([("moto", 1), ("auto", 1)]) == 690


def test_mixte_toutes_lignes_a_2_gratuit():
    assert _ht([("auto", 2), ("camion", 4), ("agricole", 2)]) == 0


def test_famille_inconnue_forfait_auto():
    # Robustesse : ancienne ligne de panier sans catégorie -> forfait auto
    assert _ht([("velo", 1)]) == 690


def test_panier_vide_gratuit():
    assert _ht([]) == 0
