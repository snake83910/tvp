"""Extraction de l'IP client derrière un reverse proxy.

X-Forwarded-For est une liste : chaque proxy AJOUTE l'IP de son
appelant à droite. Le client peut envoyer lui-même un faux en-tête,
qui se retrouve alors À GAUCHE des entrées ajoutées par nos proxys.
Prendre la première entrée (comme souvent recopié des tutos) permet
donc de contourner le rate limiting et de polluer les logs de
connexion avec une IP arbitraire.

On prend l'entrée LA PLUS À DROITE : celle écrite par notre nginx,
donc la vraie IP de connexion. (Si nginx écrase l'en-tête au lieu
d'ajouter, première == dernière, ça reste correct.)
"""
from fastapi import Request


def client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[-1].strip() or None
    return request.client.host if request.client else None
