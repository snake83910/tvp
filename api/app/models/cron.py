"""Trace d'exécution des jobs planifiés.

Les jobs `/cron/*` sont appelés par le crontab du VPS. Rien, jusqu'ici,
ne disait s'ils tournaient : un crontab perdu au redéploiement ou un
`CRON_TOKEN` régénéré sans mise à jour de la ligne cron arrêtait
silencieusement les relances de paiement, les rappels de rendez-vous et
les demandes d'avis. Le premier signal aurait été un client qui se
plaint — c'est-à-dire trop tard.

Une ligne par job, écrasée à chaque passage : on ne veut pas un journal,
on veut savoir si le job est vivant. L'historique détaillé, c'est le
rôle des logs applicatifs.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CronRun(Base):
    __tablename__ = "cron_runs"

    # Le nom du job EST la clé : une seule ligne par job, mise à jour.
    job: Mapped[str] = mapped_column(String(50), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    # ok | error — un job qui lève doit laisser une trace, sinon
    # « dernière exécution il y a 3 jours » serait le seul indice.
    status: Mapped[str] = mapped_column(String(10), default="ok")
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    # Ce que le job a fait (son dict de retour) ou le message d'erreur.
    detail: Mapped[dict] = mapped_column(JSONB, default=dict)
