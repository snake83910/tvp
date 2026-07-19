from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def _no_dev_defaults_in_production(self) -> "Settings":
        """Refus de démarrer en production avec des valeurs de dev.
        Même principe que le garde-fou CORS_ORIGINS=* plus bas."""
        if self.environment != "production":
            return self
        if self.jwt_secret == "CHANGE_ME":
            raise ValueError(
                "JWT_SECRET est resté sur sa valeur par défaut. "
                "Génère un secret via : openssl rand -hex 32"
            )
        if self.payment_provider == "simulated":
            raise ValueError(
                "PAYMENT_PROVIDER=simulated est interdit en production : "
                "n'importe quel client pourrait valider ses commandes. "
                "Configurer PAYMENT_PROVIDER=sogecommerce."
            )
        return self

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
    # 30 min : compromis fraîcheur des prix affichés / volume d'appels
    # Maxityre. Les prix bougent réellement en journée (constaté), et le
    # checkout revalide toujours en direct + invalide le cache des
    # dimensions dont le prix a changé. Ajustable via MAXITYRE_CACHE_TTL.
    maxityre_cache_ttl: int = 1800
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

    # Sentry — error tracking. Vide = désactivé. Format DSN public Sentry :
    # https://xxxxx@oxxxx.ingest.sentry.io/xxxxx
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.1  # 10% des requêtes tracées (perf)

    # Token secret partagé pour les jobs cron (curl depuis crontab).
    # Vide = jobs cron désactivés. Génère via : openssl rand -hex 32
    cron_token: str = ""

    # SIV — recherche par plaque d'immatriculation française
    # Inscription gratuite sur https://www.apiplaqueimmatriculation.com
    # Free tier ~100 req/jour. Mettre la clé dans .env : SIV_API_KEY=xxxx
    siv_api_key: str = ""
    siv_api_url: str = "https://www.apiplaqueimmatriculation.com/GetInfosVehicule.php"

    # ── Mentions légales de l'émetteur (facture PDF) ──────────────
    # Obligatoires sur une facture de SAS assujettie à la TVA
    # (art. L441-9 code de commerce, art. 242 nonies A ann. II CGI).
    # Laissées VIDES exprès : ce sont des identifiants légaux, ils
    # doivent venir du Kbis, pas d'une valeur par défaut inventée.
    # Chaque ligne renseignée s'affiche, les vides sont omises.
    company_legal_name: str = ""    # ex. "TOUS VOS PNEUS SAS"
    company_capital: str = ""       # ex. "10 000 EUR"
    company_address: str = ""       # ex. "12 rue de la Republique"
    company_city: str = ""          # ex. "13001 Marseille"
    company_siret: str = ""         # 14 chiffres
    company_rcs: str = ""           # ex. "Marseille B 123 456 789"
    company_vat_number: str = ""    # ex. "FR12345678901"

settings = Settings()
