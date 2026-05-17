from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Base de données
    database_url: str = "postgresql+asyncpg://tvp:changeme_dev@postgres:5432/tvp"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    jwt_secret: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    # App
    environment: str = "development"
    api_base_url: str = "http://localhost:8000"

    # Fournisseur Maxityre / AD Tyres
    maxityre_base_url: str = "https://api.maxityre.com"
    maxityre_site_id: str = "4"
    maxityre_username: str = ""
    maxityre_password: str = ""
    maxityre_cache_ttl: int = 600  # secondes (cache prix/dispo)

    # Paiement : "simulated" (dev) ou "sogecommerce" (prod, contrat actif)
    payment_provider: str = "simulated"
    sogecommerce_hmac_key: str = ""
    sogecommerce_shop_id: str = ""
    sogecommerce_api_password: str = ""


settings = Settings()
