"""
Tests de régression du parsing de dimensions.

Une dimension mal parsée = mauvais pneu livré = litige. Ces cas DOIVENT
rester verts. Lancer : pytest app/tests/test_normalize.py
"""
from app.modules.catalog.normalize import map_season, parse_dimension


def test_formats_metriques_standard():
    d = parse_dimension("205/55R16 91V")
    assert (d.width, d.aspect_ratio, d.diameter) == (205, 55, 16)
    assert d.load_index == 91 and d.speed_rating == "V"


def test_avec_espaces():
    d = parse_dimension("205/55 R16 91V")
    assert (d.width, d.aspect_ratio, d.diameter) == (205, 55, 16)


def test_zr():
    d = parse_dimension("225/45ZR17 94Y")
    assert d.diameter == 17 and d.speed_rating == "Y"


def test_utilitaire_C_garde_charge_et_vitesse():
    # Bug trouvé en test : le C cassait charge/vitesse. Doit rester corrigé.
    d = parse_dimension("235/65 R16C 115/113R")
    assert d.width == 235 and d.diameter == 16
    assert d.load_index == 115 and d.speed_rating == "R"


def test_indices_doubles_garde_le_premier():
    d = parse_dimension("195/65 R15 91/89 T")
    assert d.load_index == 91


def test_format_pouces_us_refuse():
    # Bug critique trouvé en test : sortait une fausse dimension.
    # Doit renvoyer None (refus propre, jamais une devinette).
    assert parse_dimension("31x10.50R15 109S") is None


def test_garbage_et_vide():
    assert parse_dimension("") is None
    assert parse_dimension("DIMENSION_INCONNUE") is None


def test_sans_charge_vitesse():
    d = parse_dimension("205/55R16")
    assert d.load_index is None and d.speed_rating is None


def test_saisons():
    assert map_season("G") == "4saisons"
    assert map_season("S") == "ete"
    assert map_season("W") == "hiver"
    assert map_season(None) == "inconnu"
