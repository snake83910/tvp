"""
Module Mailer — envoi d'emails transactionnels.

Conception en couches :
- `Mailer` (cette classe abstraite) définit l'interface unique
- Plusieurs implémentations possibles (`SMTPMailer`, `ConsoleMailer`, etc.)
- Le code métier (registration, paiement...) appelle TOUJOURS la même
  méthode `send_html(...)` sans connaître l'implémentation. On peut
  donc basculer SMTP -> Brevo plus tard sans toucher au code métier.

Choix techniques :
- Templates Jinja2 stockés à côté du code (pas de DB).
- Envoi en arrière-plan via asyncio.create_task pour ne pas bloquer
  la réponse HTTP : si IONOS met 3 secondes à répondre, le client
  voit "commande validée" tout de suite.
- En cas d'échec, on LOG mais on ne lève pas d'exception : un mail
  qui ne part pas ne doit jamais casser une commande déjà payée.
"""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

log = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_jinja = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    enable_async=False,
)


@dataclass
class EmailMessage:
    """Message à envoyer. Toujours en HTML + version texte optionnelle."""
    to: str
    subject: str
    html: str
    text: str | None = None  # fallback pour clients qui ne lisent que le texte


class Mailer(ABC):
    """Interface abstraite. Toute implémentation expose `send`."""

    @abstractmethod
    async def send(self, msg: EmailMessage) -> bool:
        """Envoie le message. Renvoie True si OK, False sinon (jamais lève)."""
        ...

    def render(
        self, template_name: str, **context: Any
    ) -> str:
        """Rend un template Jinja2. Lève si template manquant (= bug)."""
        tpl = _jinja.get_template(template_name)
        return tpl.render(**context)

    async def send_template(
        self,
        to: str,
        subject: str,
        template: str,
        **context: Any,
    ) -> bool:
        """Helper de haut niveau : rend le template + envoie en background."""
        try:
            html = self.render(template, **context)
        except Exception:
            # Template manquant ou rendu KO = bug applicatif, à corriger
            log.exception(
                "Echec rendu template %s pour %s", template, to
            )
            return False
        return await self.send(EmailMessage(to=to, subject=subject, html=html))


def fire_and_forget(coro):
    """
    Lance une coroutine en tâche d'arrière-plan, sans attendre son résultat.

    Utilisé pour que l'envoi d'email ne bloque PAS la réponse HTTP au
    client. Si l'envoi échoue, le mailer logge l'erreur - on ne veut
    JAMAIS faire échouer une commande payée pour un email raté.
    """
    return asyncio.create_task(coro)
