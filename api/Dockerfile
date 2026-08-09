# ── Étape 1 : compilation des dépendances ────────────────────────────
# build-essential ne sert qu'à compiler les extensions C des paquets qui
# n'ont pas de wheel. Le laisser dans l'image finale, c'est livrer un
# compilateur en production : de quoi transformer une exécution de code
# arbitraire en compromission durable. Il reste ici et n'ira pas plus loin.
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Environnement virtuel isolé : c'est le seul artefact recopié dans
# l'image finale, ce qui garantit qu'aucun outil de compilation ne suit.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
# Le pip fourni par l'image de base traîne ses propres CVE (pip-audit les
# remonte sur l'image finale). On le met à jour avant d'installer.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Étape 2 : image d'exécution ──────────────────────────────────────
FROM python:3.12-slim AS runtime

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# UID fixe : sur un volume persistant, l'appartenance des fichiers est
# stockée en numérique. Un UID attribué automatiquement pourrait changer
# d'une reconstruction à l'autre et rendre les Kbis déjà déposés
# illisibles par l'application.
#
# /app/uploads est créé ICI, appartenant à appuser, et c'est volontaire :
# quand Docker initialise un volume nommé vide, il en recopie le contenu
# ET le propriétaire depuis ce chemin de l'image. Sans ce mkdir, le
# volume serait créé par Docker en root et l'application, non privilégiée,
# ne pourrait plus écrire un seul document de garage.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/uploads

COPY --chown=appuser:appuser . .

RUN chown -R appuser:appuser /app

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ── Étape 3 : image de développement ─────────────────────────────────
# Le venv de l'étape « runtime » appartient à root et l'application tourne
# en appuser : elle ne peut donc pas s'installer de paquets, y compris si
# elle est compromise. Bonne propriété — mais elle empêche aussi
# d'installer pytest à la volée, alors que le README documente le lancement
# des tests dans le conteneur. Cette étape les pose à la construction.
#
# docker-compose.yml cible « dev », l'overlay de production cible
# « runtime » : l'outillage de test ne peut pas se retrouver en production
# par distraction.
FROM runtime AS dev

USER root
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
USER appuser
