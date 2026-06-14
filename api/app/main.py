from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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
async def health():
    return {"status": "ok", "env": settings.environment}


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(catalog_router)
app.include_router(cart_router)
app.include_router(payment_router)
