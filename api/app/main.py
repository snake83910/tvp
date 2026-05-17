from fastapi import FastAPI

from app.core.config import settings
from app.modules.accounts.router import router as accounts_router
from app.modules.auth.router import router as auth_router
from app.modules.cart.router import router as cart_router
from app.modules.catalog.router import router as catalog_router
from app.modules.orders.payment_router import router as payment_router

app = FastAPI(
    title="tousvospneus.com API",
    version="0.1.0",
    description="Backend e-commerce pneus — dropshipping B2C + B2B",
)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "env": settings.environment}


app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(catalog_router)
app.include_router(cart_router)
app.include_router(payment_router)
