import json
import logging
import sys
from datetime import UTC, datetime

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.cache import get_redis
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.db.session import SessionLocal


class JsonFormatter(logging.Formatter):
    """Format des logs en JSON pour parsing facile (jq, Loki, etc.)."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _setup_logging() -> None:
    root = logging.getLogger()
    # Éviter le double-format au reload
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)


_setup_logging()


def _setup_sentry() -> None:
    """Init Sentry si SENTRY_DSN est configuré."""
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=settings.sentry_traces_sample_rate,
            integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            # On n'envoie PAS d'infos personnelles (emails, mots de passe) à Sentry
            send_default_pii=False,
        )
    except ImportError:
        logging.getLogger(__name__).warning("sentry-sdk non installé, monitoring désactivé")


_setup_sentry()


# ruff: E402 assumé sur ce bloc. Sentry doit être initialisé AVANT que les
# modules applicatifs ne soient importés, sinon son instrumentation ne
# s'accroche pas aux bibliothèques déjà chargées. Remonter ces imports en
# tête du fichier désactiverait silencieusement le monitoring.
from contextlib import asynccontextmanager  # noqa: E402

from app.modules.accounts.router import router as accounts_router  # noqa: E402
from app.modules.admin.router import router as admin_router  # noqa: E402
from app.modules.auth.router import router as auth_router  # noqa: E402
from app.modules.auth.totp_router import router as totp_router  # noqa: E402
from app.modules.cart.router import router as cart_router  # noqa: E402
from app.modules.catalog.router import router as catalog_router  # noqa: E402
from app.modules.cron.router import router as cron_router  # noqa: E402
from app.modules.garage.router import router as garage_router  # noqa: E402
from app.modules.orders.payment_router import router as payment_router  # noqa: E402


@asynccontextmanager
async def _lifespan(app: FastAPI):
    yield
    # Emails partis en arrière-plan : on leur laisse le temps de finir.
    # Sans ça, un redéploiement tue les envois lancés une seconde plus
    # tôt — typiquement la confirmation d'une commande qui vient d'être
    # payée.
    from app.modules.mailer.base import drain_pending
    await drain_pending()

    # Fermeture propre du client httpx partagé (connexions keep-alive)
    from app.integrations.maxityre import aclose_shared_client
    await aclose_shared_client()


# Doc interactive : ouverte en dev (c'est l'outil de travail et la doc de
# référence pour l'app mobile), fermée en production. Laissée ouverte, elle
# publie toute la surface d'API — y compris /admin/* et /cron/* — et offre
# à un attaquant la liste exacte des routes, paramètres et schémas à
# essayer. Le contrat OpenAPI reste récupérable hors production.
_docs_open = settings.environment != "production"

app = FastAPI(
    title="tousvospneus.com API",
    version="0.1.0",
    description="Backend e-commerce pneus — dropshipping B2C + B2B",
    lifespan=_lifespan,
    docs_url="/docs" if _docs_open else None,
    redoc_url="/redoc" if _docs_open else None,
    openapi_url="/openapi.json" if _docs_open else None,
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """En-têtes de sécurité posés directement par l'API.

    Le front Next.js pose déjà sa propre CSP/HSTS sur les pages qu'il rend,
    mais ces en-têtes ne couvrent PAS les réponses de l'API si elle est
    atteinte hors du proxy /api (appel direct, app mobile, sonde). Défense
    en profondeur : on ne renvoie pas de HTML, donc pas de CSP ici, mais on
    verrouille le sniffing MIME, le framing et la fuite de referer.
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Cache-Control", "no-store"
        )  # réponses API = données fraîches, jamais mises en cache par un proxy
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Format d'erreur unique : toute sortie d'erreur porte un `code` stable
# que les clients peuvent tester, au lieu du message français.
install_error_handlers(app)

# CORS : le navigateur charge le site depuis une origine (ex.
# http://localhost:3000) et appelle l'API sur une autre
# (http://localhost:8000). Sans ces en-têtes, le navigateur bloque
# les requêtes (preflight OPTIONS qui échoue). La liste des origines
# autorisées est configurable via .env (CORS_ORIGINS), pour passer
# en production sans toucher au code.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health(response: Response):
    """Healthcheck applicatif : vérifie DB + Redis.
    Retourne 503 si l'un des deux est indisponible."""
    checks: dict[str, str] = {}
    healthy = True

    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"error: {exc.__class__.__name__}"
        healthy = False

    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc.__class__.__name__}"
        healthy = False

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if healthy else "degraded", "env": settings.environment, "checks": checks}


@app.get("/health/jobs", tags=["system"])
async def health_jobs(response: Response):
    """Les jobs planifiés tournent-ils encore ?

    Endpoint SÉPARÉ de /health, volontairement. Un job en retard ne veut
    pas dire que le site est tombé : mélanger les deux ferait crier
    « site indisponible » pour une relance email en retard, et cette
    alerte-là finirait par être ignorée. Deux sondes, deux significations.

    Retourne 503 dès qu'un job n'a pas tourné depuis plus de DEUX fois
    sa période — assez tolérant pour absorber un passage manqué, assez
    strict pour voir un crontab perdu au redéploiement.

    Endpoint PUBLIC, comme /health : une sonde externe doit pouvoir
    l'appeler. Il ne rend donc que l'état et l'horodatage — jamais les
    compteurs métier du job (commandes relancées, avis envoyés), qui
    renseigneraient un tiers sur le volume d'activité. Le détail est
    servi par `/v1/admin/cron-runs`, derrière authentification.
    """
    from app.models.cron import CronRun
    from app.modules.cron.router import JOB_PERIOD_MINUTES

    now = datetime.now(UTC)
    jobs: dict[str, dict] = {}
    healthy = True

    try:
        async with SessionLocal() as db:
            rows = {r.job: r for r in (await db.scalars(select(CronRun))).all()}
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "error": f"{exc.__class__.__name__}"}

    for job, period in JOB_PERIOD_MINUTES.items():
        run = rows.get(job)
        if run is None or run.finished_at is None:
            # Jamais vu tourner. Sur une base neuve c'est normal une
            # heure ou deux ; passé ce délai, la ligne crontab manque.
            jobs[job] = {"state": "never_ran"}
            healthy = False
            continue
        age = (now - run.finished_at).total_seconds() / 60
        late = age > 2 * period
        jobs[job] = {
            "state": "late" if late else run.status,
            "last_run": run.finished_at.isoformat(),
            "minutes_ago": int(age),
        }
        if late or run.status != "ok":
            healthy = False

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if healthy else "degraded", "jobs": jobs}


# Version de l'API dans le chemin. Posée AVANT qu'un tiers ne consomme
# quoi que ce soit : la doc publique et l'application mobile sont au
# programme, et le jour où elles existent, plus rien n'est renommable
# sans casser des clients qu'on ne contrôle pas. Une ligne aujourd'hui,
# une migration pour tout le monde plus tard.
API_V1 = "/v1"

for _router in (
    admin_router,
    auth_router,
    totp_router,
    accounts_router,
    catalog_router,
    garage_router,
    cart_router,
    payment_router,
):
    app.include_router(_router, prefix=API_V1)

# ── Surfaces volontairement NON versionnées ──────────────────────────
# Ce ne sont pas des API produit : personne n'écrit de client dessus, et
# les déplacer casserait des configurations extérieures au dépôt.
#
# /payment/ipn est déclarée chez Sogecommerce : la banque appelle cette
# URL exacte. L'alias ci-dessous la maintient en vie ; il est masqué de
# la doc pour que /v1/payment reste la seule surface annoncée.
app.include_router(payment_router, include_in_schema=False)
# /cron/* est appelé par le crontab du VPS, /health par les sondes.
app.include_router(cron_router)
