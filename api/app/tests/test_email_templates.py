"""
Tests de l'édition des templates d'email depuis l'administration.

Éditer un template, c'est modifier ce que lisent les clients — et
c'est aussi, si on n'y prend garde, exécuter du code sur le serveur.
Trois garanties comptent ici :

  * **Bac à sable.** Jinja non bridé permet d'atteindre les objets
    Python sous-jacents. Un compte admin compromis deviendrait une
    exécution de code. Un administrateur est digne de confiance, sa
    session volée ne l'est pas.
  * **Validation avant enregistrement.** Une accolade oubliée casserait
    silencieusement les confirmations de commande, et on l'apprendrait
    par un client.
  * **Le fichier reste la référence.** « Réinitialiser » doit vraiment
    rendre la main au fichier versionné.

Lancer : pytest app/tests/test_email_templates.py
"""
import jinja2
import pytest

from app.modules.mailer import templates_admin as tpl

# ── Périmètre ─────────────────────────────────────────────────────

def test_les_templates_livres_sont_listes():
    noms = tpl.list_names()
    assert "order_confirmation.html" in noms
    assert "_layout.html" in noms
    # Uniquement des .html du dossier, rien d'autre.
    assert all(n.endswith(".html") for n in noms)


def test_nom_hors_dossier_refuse():
    """Le nom vient d'une URL : sans contrôle, `../../.env` serait un
    template parfaitement lisible."""
    for evasion in ("../../.env", "/etc/passwd", "..%2F.env", "inconnu.html"):
        with pytest.raises(FileNotFoundError):
            tpl.default_source(evasion)


# ── Bac à sable ───────────────────────────────────────────────────

def test_acces_aux_internes_python_bloque():
    """LE test à ne jamais laisser rougir : l'évasion classique doit
    échouer, pas rendre le contenu du serveur."""
    for charge in (
        "{{ cycler.__init__.__globals__ }}",
        "{{ ''.__class__.__mro__ }}",
        "{{ self.__init__.__globals__ }}",
    ):
        with pytest.raises(Exception) as exc:
            tpl.render_preview(charge)
        assert "Security" in type(exc.value).__name__ or "unsafe" in str(exc.value)


def test_template_valide_rendu_avec_des_exemples():
    html = tpl.render_preview(
        "<p>{{ civilite }} — {{ order_number }}</p>"
    )
    assert "Bonjour Camille" in html
    assert "CMD-2026-000123" in html


def test_variable_inconnue_visible_dans_l_apercu():
    """Un trou dans un aperçu est indiscernable d'une variable oubliée :
    on montre le nom entre chevrons."""
    html = tpl.render_preview("<p>{{ variable_inventee }}</p>")
    assert "‹variable_inventee›" in html


def test_heritage_du_squelette_conserve():
    """Une surcharge doit pouvoir continuer d'étendre `_layout.html`,
    sinon elle perdrait l'en-tête et le pied de page."""
    html = tpl.render_preview(
        '{% extends "_layout.html" %}{% block content %}<p>Corps</p>{% endblock %}'
    )
    assert "Corps" in html
    assert "TOUSVOSPNEUS" in html


def test_template_casse_leve():
    with pytest.raises(jinja2.TemplateError):
        tpl.render_preview("{% if x %}accolade jamais fermée")


# ── Tous les templates livrés doivent rester rendables ────────────

@pytest.mark.parametrize("name", tpl.list_names())
def test_chaque_template_livre_se_rend(name):
    """Garde-fou de non-régression : un template ajouté avec une
    variable non prévue casserait l'aperçu de l'administration — et
    surtout signalerait un envoi réel qui échouerait."""
    if name == "_layout.html":
        pytest.skip("squelette : rendu via les templates qui l'étendent")
    tpl.render_preview(tpl.default_source(name))


# ── Garde-fous d'enregistrement ───────────────────────────────────

@pytest.mark.asyncio
async def test_squelette_non_modifiable():
    """`_layout.html` porte l'en-tête et le pied de TOUS les emails :
    une erreur dedans les casse d'un coup."""
    from unittest.mock import AsyncMock

    with pytest.raises(ValueError, match="squelette"):
        await tpl.save_override(AsyncMock(), "_layout.html", "<p>x</p>", "a@b.c")


@pytest.mark.asyncio
async def test_enregistrement_refuse_un_template_invalide():
    """Sans ce contrôle, une accolade oubliée casserait les
    confirmations de commande en silence."""
    from unittest.mock import AsyncMock

    db = AsyncMock()
    with pytest.raises(jinja2.TemplateError):
        await tpl.save_override(
            db, "welcome.html", "{% for x in %}", "a@b.c"
        )
    db.add.assert_not_called()
