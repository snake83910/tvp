"""
Tests de la recherche par plaque à deux fournisseurs.

Le site interrogeait l'API interne de Midas en imitant l'empreinte TLS
de Chrome. Ça fonctionne, mais ça dépend du bon vouloir d'un concurrent
direct et se défend mal. `apiplaqueimmatriculation.com` est un
fournisseur en règle, avec un quota — d'où la chaîne, et le réglage qui
permet d'en changer l'ordre sans redéploiement.

Deux points méritent des tests plutôt qu'une relecture :

  * la CHAÎNE — un fournisseur muet ne doit pas laisser le client sans
    réponse quand l'autre sait répondre ;
  * la distinction « pas trouvé » / « pas disponible ». Confondre les
    deux ferait dire au client que son véhicule est inconnu alors que
    c'est nous qui n'avons pas su répondre.

Lancer : pytest app/tests/test_plate_lookup.py
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.modules.catalog import plate


@pytest.fixture(autouse=True)
def _pas_de_cache_ni_compteur():
    """Redis n'est pas la matière du test : le cache masquerait la
    chaîne, et les compteurs sont déjà tolérants aux pannes."""
    with patch.object(plate, "cache_get", AsyncMock(return_value=None)), \
         patch.object(plate, "cache_set", AsyncMock()), \
         patch.object(plate, "_bump", AsyncMock()):
        yield


def _db(mode="siv"):
    db = AsyncMock()
    db.scalar = AsyncMock(return_value=mode)
    return db


DIMS = [
    {
        "width": 205, "height": 55, "diameter": 16,
        "load_index": "91", "speed_rating": "V",
    }
]


# ── Normalisation ─────────────────────────────────────────────────

def test_nettoyage_de_plaque():
    assert plate.clean_plate("aa-123-aa") == "AA123AA"
    assert plate.clean_plate(" AA 123 AA ") == "AA123AA"
    assert plate.clean_plate("1234 AB 56") == "1234AB56"
    # Format aberrant : refusé avant tout appel réseau.
    assert plate.clean_plate("AA") is None
    assert plate.clean_plate("AA-123-AA-XYZ-999") is None
    assert plate.clean_plate("") is None


# ── Ordre des fournisseurs ────────────────────────────────────────

def test_ordre_selon_le_mode():
    with patch.object(plate, "siv_configured", lambda: True):
        assert [n for n, _ in plate._providers("siv")] == ["siv", "midas"]
        assert [n for n, _ in plate._providers("siv_only")] == ["siv"]
        assert [n for n, _ in plate._providers("midas")] == ["midas"]


def test_sans_cle_siv_est_retire_de_la_chaine():
    """Inutile de provoquer une erreur pour retomber sur Midas : SIV
    est simplement absent, et l'écran d'admin signale la clé manquante."""
    with patch.object(plate, "siv_configured", lambda: False):
        assert [n for n, _ in plate._providers("siv")] == ["midas"]
        # Mode exclusif sans clé : plus personne pour répondre.
        assert plate._providers("siv_only") == []


@pytest.mark.asyncio
async def test_siv_only_sans_cle_dit_indisponible():
    """Et surtout PAS « plaque introuvable » : le véhicule n'y est pour
    rien."""
    with patch.object(plate, "siv_configured", lambda: False), \
         pytest.raises(plate.PlateUnavailableError):
        await plate.lookup(_db("siv_only"), "AA123AA")


# ── Repli ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_siv_repond_midas_pas_appele():
    siv = AsyncMock(return_value=DIMS)
    midas = AsyncMock(return_value=[])
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        dims, provider = await plate.lookup(_db("siv"), "AA123AA")

    assert provider == "siv"
    assert dims == DIMS
    midas.assert_not_awaited()


@pytest.mark.asyncio
async def test_siv_en_panne_midas_prend_le_relais():
    """LE cas qui justifie la chaîne : quota atteint ou API muette ne
    doivent pas laisser le client sans réponse."""
    siv = AsyncMock(side_effect=RuntimeError("quota dépassé"))
    midas = AsyncMock(return_value=DIMS)
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        dims, provider = await plate.lookup(_db("siv"), "AA123AA")

    assert provider == "midas"
    assert dims == DIMS


@pytest.mark.asyncio
async def test_siv_only_ne_touche_jamais_a_midas():
    """Le mode existe pour cette garantie : aucun appel au concurrent,
    même en panne."""
    siv = AsyncMock(side_effect=RuntimeError("panne"))
    midas = AsyncMock(return_value=DIMS)
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        with pytest.raises(plate.PlateUnavailableError):
            await plate.lookup(_db("siv_only"), "AA123AA")

    midas.assert_not_awaited()


@pytest.mark.asyncio
async def test_plaque_inconnue_des_deux():
    siv = AsyncMock(side_effect=plate.PlateNotFoundError())
    midas = AsyncMock(side_effect=plate.PlateNotFoundError())
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        with pytest.raises(plate.PlateNotFoundError):
            await plate.lookup(_db("siv"), "AA123AA")

    # Les deux ont été essayés : leurs bases diffèrent, l'un peut
    # connaître une plaque que l'autre ignore.
    midas.assert_awaited_once()


@pytest.mark.asyncio
async def test_inconnue_chez_l_un_connue_chez_l_autre():
    siv = AsyncMock(side_effect=plate.PlateNotFoundError())
    midas = AsyncMock(return_value=DIMS)
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        dims, provider = await plate.lookup(_db("siv"), "AA123AA")

    assert (dims, provider) == (DIMS, "midas")


@pytest.mark.asyncio
async def test_reponse_vide_vaut_non_trouvee():
    """Un fournisseur qui répond « véhicule connu, pneus inconnus » ne
    doit pas produire une liste vide côté client."""
    siv = AsyncMock(return_value=[])
    midas = AsyncMock(return_value=[])
    with patch.object(plate, "siv_configured", lambda: True), \
         patch.object(plate, "_from_siv", siv), \
         patch.object(plate, "_from_midas", midas):
        with pytest.raises(plate.PlateNotFoundError):
            await plate.lookup(_db("siv"), "AA123AA")


# ── Dédoublonnage ─────────────────────────────────────────────────

def test_montages_avant_arriere_conserves():
    """Un SUV peut monter des dimensions différentes AV/AR : on garde
    les deux, mais pas deux fois la même."""
    av = {"width": 235, "height": 55, "diameter": 19}
    ar = {"width": 255, "height": 50, "diameter": 19}
    assert len(plate._dedupe([av, ar, dict(av)])) == 2


# ── Réglage ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mode_inconnu_retombe_sur_le_defaut():
    """Un réglage corrompu ne doit pas casser la recherche."""
    assert await plate.get_mode(_db("n_importe_quoi")) == plate.DEFAULT_MODE
    assert await plate.get_mode(_db(None)) == plate.DEFAULT_MODE


@pytest.mark.asyncio
async def test_ecriture_d_un_mode_inconnu_refusee():
    db = AsyncMock()
    with pytest.raises(ValueError):
        await plate.set_mode(db, "google")
    db.add.assert_not_called()
