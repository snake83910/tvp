"""
Factory du Mailer.

Centralisé pour qu'on bascule provider via UNE variable .env :
- MAILER_PROVIDER=console  -> ConsoleMailer (logs Docker, pas d'envoi)
- MAILER_PROVIDER=smtp     -> SMTPMailer (IONOS / OVH / Gmail SMTP)
- (à venir : brevo, postmark, ...)
"""
from functools import lru_cache

from app.core.config import settings
from app.modules.mailer.base import Mailer
from app.modules.mailer.providers import ConsoleMailer, SMTPMailer


@lru_cache(maxsize=1)
def get_mailer() -> Mailer:
    """Renvoie le Mailer configuré. Cache lru -> instance unique."""
    provider = (settings.mailer_provider or "console").lower()

    if provider == "smtp":
        return SMTPMailer(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            sender=settings.smtp_sender or settings.smtp_username,
            use_ssl=settings.smtp_use_ssl,
        )

    # Défaut : console (sans surprise en dev)
    return ConsoleMailer()
