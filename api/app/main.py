import json
import logging
import sys
from datetime import datetime, timezone

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.cache import get_redis
from app.core.config import settings
from app.db.session import SessionLocal


class JsonFormatter(logging.Formatter):
    """Format des logs en JSON pour parsing facile (jq, Loki, etc.)."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
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
from app.modules.accounts.router import router as accounts_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.cart.router import router as cart_router
from app.modules.catalog.router import router as catalog_router
from app.modules.orders.payment_router import router as payment_router

app = FastAPI(
    title="tousvospneus.com API",
    version="0.1.0",
    description="Backend e-commerce pneus — dropshipping B2C + B2B",
)

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


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(catalog_router)
app.include_router(cart_router)
app.include_router(payment_router)
