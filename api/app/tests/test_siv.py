"""
Tests du fournisseur apiplaqueimmatriculation.com.

Écrits à partir d'une réponse RÉELLE relevée en production (plaque
HG066TH, Citroën DS3). La version précédente du module supposait une
réponse à plat avec un champ `Pneus` en texte : sur ce payload, elle
n'aurait rien trouvé et aurait annoncé « plaque non reconnue » à chaque
appel. D'où ces tests sur la charge utile exacte plutôt que sur une
forme imaginée.

Deux exigences :

  * lire les dimensions là où elles sont réellement — sous `data`, dans
    un tableau `pneus` déjà structuré ;
  * distinguer un véhicule inconnu d'un accès refusé. Confondre les deux
    ferait dire au client que sa voiture n'existe pas alors que c'est
    notre quota qui est épuisé — et empêcherait le repli.

Lancer : pytest app/tests/test_siv.py
"""
import pytest

from app.integrations.siv import (
    DEFAULT_URL,
    PlateAccessError,
    _parse_response,
    resolve_url,
    vehicle_label,
)

#: Réponse réelle du provider, tronquée aux champs qui nous concernent
#: (l'original porte une cinquantaine de clés véhicule).
REPONSE_REELLE = {
    "data": {
        "erreur": "",
        "immat": "HG066TH",
        "pays": "FR",
        "marque": "CITROEN",
        "modele": "DS3",
        "version": "1.6 E-HDI",
        "energieNGC": "DIESEL",
        "vin": "VF7SA9HPKCW590386",
        "poids": "1602 KG",
        "ccm": "1560 CM3",
        "pneus": [
            {
                "name": "205/45 R 17", "width": 205, "height": 45,
                "diameter": 17, "load_index": 88, "speed_index": "V",
            },
            {
                "name": "195/55 R 16", "width": 195, "height": 55,
                "diameter": 16, "load_index": 87, "speed_index": "T",
            },
        ],
    },
    "api_version": "V1",
    "message": "",
    "code_erreur": 200,
}


def test_les_deux_montages_sont_rendus():
    """Un véhicule peut avoir plusieurs montages homologués. En garder
    un seul priverait le client du sien."""
    dims = _parse_response(REPONSE_REELLE)

    assert len(dims) == 2
    assert dims[0] == {
        "width": 205, "height": 45, "diameter": 17,
        "load_index": "88", "speed_rating": "V",
    }
    assert dims[1] == {
        "width": 195, "height": 55, "diameter": 16,
        "load_index": "87", "speed_rating": "T",
    }


def test_indice_de_charge_rendu_en_texte():
    """Le provider l'envoie en entier, le reste du site le traite comme
    une chaîne. La conversion doit se faire ici, pas trois couches plus
    haut."""
    dims = _parse_response(REPONSE_REELLE)
    assert all(isinstance(d["load_index"], str) for d in dims)
    assert all(isinstance(d["speed_rating"], str) for d in dims)


def test_reponse_a_plat_aussi_acceptee():
    """Sans enveloppe `data` — au cas où le provider la retire, ou pour
    un autre fournisseur."""
    dims = _parse_response(REPONSE_REELLE["data"])
    assert len(dims) == 2


def test_montages_identiques_dedupliques():
    payload = {"data": {"pneus": [
        {"width": 205, "height": 55, "diameter": 16, "speed_index": "V"},
        {"width": 205, "height": 55, "diameter": 16, "speed_index": "H"},
    ]}}
    assert len(_parse_response(payload)) == 1


def test_repli_sur_le_libelle_texte():
    """Filet de sécurité : si les entiers manquent, le libellé porte la
    même information."""
    payload = {"data": {"pneus": [{"name": "225/40 R 18 92W"}]}}
    dims = _parse_response(payload)
    assert dims == [{
        "width": 225, "height": 40, "diameter": 18,
        "load_index": "92", "speed_rating": "W",
    }]


def test_champ_pneus_absent_balayage_des_chaines():
    """Si le provider renomme son champ sans prévenir, on retrouve
    quand même la dimension plutôt que de rendre une liste vide."""
    payload = {"data": {"marque": "PEUGEOT", "monte": "195/65 R15 91H"}}
    assert _parse_response(payload)[0]["width"] == 195


def test_vehicule_sans_dimensions():
    payload = {"data": {"marque": "CITROEN", "modele": "DS3"}}
    assert _parse_response(payload) == []


def test_libelle_vehicule():
    """Deux montages proposés : afficher le véhicule reconnu aide le
    client à comprendre pourquoi."""
    assert vehicle_label(REPONSE_REELLE) == "CITROEN DS3 1.6 E-HDI"
    assert vehicle_label({"data": {}}) == ""


# ── URL effective ─────────────────────────────────────────────────

def test_url_periemee_heritee_dun_env_est_ignoree(monkeypatch):
    """Un .env déployé avant la correction contient l'ancien endpoint et
    écraserait silencieusement le défaut corrigé : le code est à jour,
    la production ne l'est pas, et le « 301 Moved Permanently » ne
    désigne pas sa propre cause."""
    from app.core.config import settings

    for perimee in (
        "https://www.apiplaqueimmatriculation.com/GetInfosVehicule.php",
        "https://www.apiplaqueimmatriculation.com/getinfosvehicule.php/",
        "",
    ):
        monkeypatch.setattr(settings, "siv_api_url", perimee)
        assert resolve_url() == DEFAULT_URL


def test_url_personnalisee_respectee(monkeypatch):
    """Le remplacement ne doit pas confisquer un vrai changement de
    provider."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "siv_api_url", "https://autre.example/api")
    assert resolve_url() == "https://autre.example/api"


@pytest.mark.asyncio
async def test_redirection_dit_quoi_corriger(monkeypatch):
    """Et ne suit PAS la redirection : le jeton est dans la query
    string, l'envoyer à un hôte non choisi serait le divulguer."""
    _install(monkeypatch, {}, status=301)

    from app.integrations.siv import lookup_by_plate
    with pytest.raises(PlateAccessError) as exc:
        await lookup_by_plate("EE131HC")
    assert "SIV_API_URL" in str(exc.value)


@pytest.mark.asyncio
async def test_endpoint_introuvable_dit_quoi_corriger(monkeypatch):
    _install(monkeypatch, {}, status=404)

    from app.integrations.siv import lookup_by_plate
    with pytest.raises(PlateAccessError) as exc:
        await lookup_by_plate("EE131HC")
    assert "SIV_API_URL" in str(exc.value)


# ── Distinction inconnu / refusé ──────────────────────────────────

@pytest.mark.asyncio
async def test_plaque_inconnue_leve_runtime(monkeypatch):
    payload = {"data": {"erreur": "Immatriculation introuvable"},
               "code_erreur": 200}
    _install(monkeypatch, payload)

    from app.integrations.siv import lookup_by_plate
    with pytest.raises(RuntimeError) as exc:
        await lookup_by_plate("XX999XX")
    assert not isinstance(exc.value, PlateAccessError)


@pytest.mark.asyncio
async def test_quota_epuise_nest_pas_une_plaque_inconnue(monkeypatch):
    """LE test qui protège le repli : un quota épuisé doit envoyer la
    chaîne vers l'autre fournisseur, pas annoncer au client que sa
    voiture n'existe pas."""
    _install(monkeypatch, {"code_erreur": 429, "message": "quota"}, status=200)

    from app.integrations.siv import lookup_by_plate
    with pytest.raises(PlateAccessError):
        await lookup_by_plate("HG066TH")


@pytest.mark.asyncio
async def test_cle_refusee_en_http(monkeypatch):
    _install(monkeypatch, {}, status=401)

    from app.integrations.siv import lookup_by_plate
    with pytest.raises(PlateAccessError):
        await lookup_by_plate("HG066TH")


@pytest.mark.asyncio
async def test_reponse_complete_de_bout_en_bout(monkeypatch):
    _install(monkeypatch, REPONSE_REELLE)

    from app.integrations.siv import lookup_by_plate
    dims = await lookup_by_plate("HG066TH")
    assert [(d["width"], d["diameter"]) for d in dims] == [(205, 17), (195, 16)]


def _install(monkeypatch, payload: dict, status: int = 200) -> None:
    """Remplace le client HTTP et fournit une clé, sans toucher au réseau."""
    import httpx

    from app.core.config import settings

    monkeypatch.setattr(settings, "siv_api_key", "cle-de-test")

    class FakeResponse:
        status_code = status

        def raise_for_status(self):
            if status >= 400:
                raise httpx.HTTPStatusError("boom", request=None, response=None)

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
