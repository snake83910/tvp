"""
Implémentations concrètes du Mailer.

- SMTPMailer : production via IONOS (smtp.ionos.fr:465 SSL).
- ConsoleMailer : développement local, log les emails au lieu d'envoyer.
"""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage as MimeMessage

from app.modules.mailer.base import EmailMessage, Mailer

log = logging.getLogger(__name__)


class ConsoleMailer(Mailer):
    """Mode développement : log l'email dans les logs Docker.

    Utile pour tester en local sans envoyer de vrais emails à des
    vrais clients (et sans risquer de spammer ta boîte serviceclient
    pendant tes itérations de debug).
    """

    async def send(self, msg: EmailMessage) -> bool:
        preview = msg.html[:500].replace("\n", " ")
        print("=" * 60, flush=True)
        print(f"EMAIL (mode console) -> {msg.to}", flush=True)
        print(f"Sujet : {msg.subject}", flush=True)
        print("-" * 60, flush=True)
        print(f"HTML (extrait) : {preview}...", flush=True)
        print("=" * 60, flush=True)
        return True


class SMTPMailer(Mailer):
    """
    Envoi via SMTP standard. Compatible IONOS, OVH, Gmail SMTP, etc.

    IONOS : smtp.ionos.fr:465 avec SSL (PAS STARTTLS).
    Authentification login/password.

    Attention : SMTP est synchrone à la base. Cette impl utilise
    smtplib en bloquant le thread courant. Pour ne PAS bloquer la
    boucle asyncio, on l'enveloppe dans `asyncio.to_thread()`.
    """

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        sender: str,
        use_ssl: bool = True,
        timeout: int = 10,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.sender = sender  # adresse "From:" (peut être différente du login)
        self.use_ssl = use_ssl
        self.timeout = timeout

    async def send(self, msg: EmailMessage) -> bool:
        import asyncio
        try:
            # smtplib est bloquant -> on l'exécute dans un thread pour
            # ne pas geler la boucle asyncio principale.
            await asyncio.to_thread(self._send_sync, msg)
            log.info("Email envoyé à %s : %s", msg.to, msg.subject)
            return True
        except Exception:
            # JAMAIS lever : un mail raté ne doit pas casser une commande
            log.exception(
                "Echec envoi email à %s (sujet=%s)", msg.to, msg.subject
            )
            return False

    def _send_sync(self, msg: EmailMessage) -> None:
        """Envoi SMTP en mode bloquant (à appeler depuis to_thread)."""
        mime = MimeMessage()
        mime["From"] = self.sender
        mime["To"] = msg.to
        mime["Subject"] = msg.subject

        # Version texte = HTML stripped naïvement, en fallback
        if msg.text:
            mime.set_content(msg.text)
            mime.add_alternative(msg.html, subtype="html")
        else:
            mime.set_content(msg.html, subtype="html")

        if self.use_ssl:
            # IONOS port 465 = SSL direct (pas STARTTLS)
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(
                self.host, self.port, timeout=self.timeout, context=context
            ) as srv:
                srv.login(self.username, self.password)
                srv.send_message(mime)
        else:
            # STARTTLS sur port 587 (alternative)
            with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as srv:
                srv.starttls(context=ssl.create_default_context())
                srv.login(self.username, self.password)
                srv.send_message(mime)
