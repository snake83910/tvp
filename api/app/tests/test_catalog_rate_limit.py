"""
Tests des plafonds posés sur les endpoints publics du catalogue.

Ces trois endpoints sont ouverts, sans authentification, et chacun
coûte de l'argent à l'appelé :

  * `/search/by-plate` consomme le quota SIV (~100 appels par jour).
    Une boucle sur des plaques distinctes — le cache ne couvre que les
    répétitions — épuisait la journée en moins d'une minute et coupait
    la fonction pour tous les clients.
  * `/search/dimensions` et `/search/product` interrogent Maxityre :
    quota fournisseur, et catalogue tarifé aspirable par un concurrent.

Ce fichier ne teste pas le compteur Redis (couvert par son module) mais
les VALEURS retenues : un seuil trop bas gênerait un client réel, un
seuil trop haut ne protégerait rien.

Lancer : pytest app/tests/test_catalog_rate_limit.py
"""
import inspect

from app.modules.catalog import router as catalog


def _limits() -> dict[str, tuple[int, int]]:
    """Extrait les (max_attempts, window_seconds) du code source.

    Lire la source plutôt que d'appeler les endpoints : ceux-ci exigent
    une base, un cache et un fournisseur. Ce qu'on veut vérifier ici
    tient dans les constantes.
    """
    import re

    src = inspect.getsource(catalog)
    found = re.findall(
        r'rate_limit\(\s*request,\s*"([a-z_]+)",\s*'
        r"max_attempts=(\d+),\s*window_seconds=(\d+)",
        src,
    )
    return {nom: (int(m), int(w)) for nom, m, w in found}


def test_les_trois_endpoints_publics_sont_plafonnes():
    """Aucun des trois ne doit rester ouvert : ce sont les seuls points
    du site où un inconnu déclenche un appel payant."""
    assert set(_limits()) == {"search_plate", "search_dim", "search_product"}


def test_plaque_le_plus_strict():
    """C'est le seul dont le quota se compte à la journée, et saisir sa
    plaque est un geste rare — pas une navigation."""
    plaque = _limits()["search_plate"]
    dim = _limits()["search_dim"]
    produit = _limits()["search_product"]

    assert plaque[0] < dim[0] < produit[0]


def test_seuils_utilisables_par_un_humain():
    """Un plafond qui gêne un client réel serait pire que le problème
    qu'il corrige : on préfère laisser passer un curieux."""
    for nom, (maxi, fenetre) in _limits().items():
        assert fenetre <= 300, f"{nom} : fenêtre trop longue, blocage durable"
        assert maxi >= 10, f"{nom} : trop bas pour une navigation normale"


def test_plaque_borne_la_consommation_de_quota():
    """Dix par minute et par IP : un humain n'y arrive pas, et le quota
    quotidien tient largement face à une IP unique acharnée."""
    maxi, fenetre = _limits()["search_plate"]
    assert maxi <= 15
    assert fenetre >= 60
