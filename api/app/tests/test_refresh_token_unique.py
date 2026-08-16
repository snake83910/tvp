"""
Deux jetons de rafraîchissement émis coup sur coup doivent différer.

Régression réelle : la charge utile se limitait à (sub, type, iat, exp),
et `iat`/`exp` sont des dates à la SECONDE. Deux connexions du même
compte dans la même seconde produisaient donc un jeton identique au
octet près — l'insertion du second violait la contrainte d'unicité sur
`refresh_tokens.token_hash` et renvoyait un HTTP 500 sur le chemin de
connexion. Un double-clic sur « Se connecter » suffisait.

Lancer : pytest app/tests/test_refresh_token_unique.py
"""
from app.core.security import create_access_token, create_refresh_token, decode_token


def test_deux_refresh_de_suite_different():
    a = create_refresh_token("meme-utilisateur")
    b = create_refresh_token("meme-utilisateur")
    assert a != b, "deux refresh identiques -> violation d'unicité en base"


def test_le_refresh_porte_un_jti_unique():
    a = decode_token(create_refresh_token("u"))
    b = decode_token(create_refresh_token("u"))
    assert a["jti"] and b["jti"]
    assert a["jti"] != b["jti"]
    # Le reste du contrat ne bouge pas : le sujet et le type sont lus au
    # rafraîchissement pour retrouver le compte et refuser un access token.
    assert a["sub"] == "u" and a["type"] == "refresh"


def test_lacces_reste_sans_jti():
    """L'access token n'est pas stocké : il n'a pas besoin d'identité
    propre, et l'alourdir le ferait grossir à chaque requête."""
    payload = decode_token(create_access_token("u", "particulier", "client"))
    assert "jti" not in payload
    assert payload["type"] == "access"
