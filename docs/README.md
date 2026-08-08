# Documentation — tousvospneus.com

Point d'entrée de la documentation technique et opérationnelle du projet.
Le [README racine](../README.md) décrit le produit et le démarrage rapide ;
ce dossier regroupe les guides détaillés.

## Architecture & référence

- [ARCHITECTURE_PHASE1.md](ARCHITECTURE_PHASE1.md) — architecture du socle
  (auth, comptes B2C/B2B, adresses, sécurité).

## Exploitation & déploiement

- [deploiement-vps-plesk.md](deploiement-vps-plesk.md) — déploiement sur un
  VPS Plesk (Docker Compose de production).
- [CONFIG_DNS_IONOS.md](CONFIG_DNS_IONOS.md) — SPF / DKIM / DMARC chez IONOS
  pour la délivrabilité des emails.
- [ENV_TEMPLATE.txt](ENV_TEMPLATE.txt) — variables d'environnement de
  référence (voir aussi `.env.example` à la racine).

## Intégrations

- [SOGECOMMERCE_SETUP.md](SOGECOMMERCE_SETUP.md) — activer le paiement
  Sogecommerce (Société Générale) en mode test puis production.

## Contribution

- [GIT_SETUP.md](GIT_SETUP.md) — mise en place du dépôt Git.
