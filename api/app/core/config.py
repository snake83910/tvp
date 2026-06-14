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

    # CORS : origines autorisées à appeler l'API depuis un navigateur.
    # Plusieurs origines séparées par des virgules. En prod, mettre
    # l'URL du site (ex. https://tousvospneus.com).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [
            o.strip()
            for o in self.cors_origins.split(",")
            if o.strip()
        ]
        if self.environment == "production" and "*" in origins:
            raise ValueError(
                "CORS_ORIGINS=* est refusé en production. "
                "Listez explicitement vos origines (ex. https://tousvospneus.com)."
            )
        return origins

    # Fournisseur Maxityre / AD Tyres
    maxityre_base_url: str = "https://api.maxityre.com"
    maxityre_site_id: str = "4"
    maxityre_username: str = ""
    maxityre_password: str = ""
    maxityre_cache_ttl: int = 7200  # 2h : prix peu volatils + revalidés au checkout
    maxityre_max_pages: int = 100   # garde-fou anti-boucle (100 pages = 2000 pneus)

    # Paiement : "simulated" (dev) ou "sogecommerce" (prod, contrat actif)
    payment_provider: str = "simulated"
    sogecommerce_hmac_key: str = ""
    sogecommerce_shop_id: str = ""
    sogecommerce_api_password: str = ""
    sogecommerce_public_key: str = ""   # Back Office → Clés API REST → Clé publique
    sogecommerce_ipn_url: str = "http://localhost:8000/payment/ipn"

    # Email transactionnel
    mailer_provider: str = "console"  # console | smtp
    smtp_host: str = "smtp.ionos.fr"
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_sender: str = ""             # peut différer de username
    smtp_use_ssl: bool = True         # 465 = SSL, 587 = STARTTLS

    # URL publique du site (utilisée dans les liens des emails)
    public_site_url: str = "http://localhost:3000"

    # SIV — recherche par plaque d'immatriculation française
    # Inscription gratuite sur https://www.apiplaqueimmatriculation.com
    # Free tier ~100 req/jour. Mettre la clé dans .env : SIV_API_KEY=xxxx
    siv_api_key: str = ""
    siv_api_url: str = "https://www.apiplaqueimmatriculation.com/GetInfosVehicule.php"

settings = Settings()
