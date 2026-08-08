# Git — Mise en place et utilisation

Le dépôt local est **déjà initialisé** avec un premier commit propre
(phases 1-3, aucun secret). Il reste à le pousser sur GitHub privé.

---

## 1. Créer le dépôt GitHub (à faire toi-même)

> Je ne peux pas créer le compte/dépôt à ta place : création de compte =
> action que tu dois faire (sécurité). C'est rapide.

1. Va sur https://github.com → connecte-toi (ou crée un compte).
2. Bouton **New repository**.
3. Nom : `tousvospneus` (ou ce que tu veux).
4. **IMPORTANT : coche "Private"**. Ton code = ta logique métier +
   ta connexion fournisseur. Jamais public.
5. **NE coche PAS** "Add a README" / "Add .gitignore" (le projet en a
   déjà — ça créerait un conflit au premier push).
6. **Create repository**.

GitHub affiche alors une page avec une URL du type :
`https://github.com/TON-PSEUDO/tousvospneus.git`

---

## 2. Pousser le projet (une seule fois)

Depuis le dossier `tvp` (PowerShell sous Windows), remplace l'URL par
la tienne :

```powershell
git remote add origin https://github.com/TON-PSEUDO/tousvospneus.git
git branch -M main
git push -u origin main
```

GitHub demandera de t'authentifier :
- Une fenêtre de navigateur s'ouvre → connecte-toi : c'est le plus simple.
- Sinon GitHub demande un **token** (pas ton mot de passe) : Settings →
  Developer settings → Personal access tokens → Fine-grained token,
  accès au seul dépôt `tousvospneus`, permission "Contents: Read/Write".

Une fois poussé : rafraîchis la page GitHub, ton code est là.

---

## 3. Vérifier qu'aucun secret n'est parti (réflexe sécurité)

Sur la page GitHub du dépôt, cherche le fichier `.env`.
**Il ne doit PAS exister sur GitHub** (seul `.env.example` doit y être).
Si tu vois un `.env` avec de vrais mots de passe : préviens-moi
immédiatement, on corrige avant que ça reste dans l'historique.

---

## 4. Workflow quotidien

### Après chaque modif de code chez toi

```powershell
git add -A
git commit -m "Description courte de ce que j'ai changé"
git push
```

### Récupérer une nouvelle phase / version

Fini les dossiers à recopier. Une mise à jour devient :

```powershell
git pull
docker compose up -d --build
docker compose exec api alembic upgrade head
```

Ton `.env` n'est jamais touché (il est dans `.gitignore`), tes secrets
restent locaux.

### Déploiement futur sur le VPS

Exactement la même chose côté serveur :

```bash
git clone https://github.com/TON-PSEUDO/tousvospneus.git
# créer le .env de PRODUCTION (secrets différents du local !)
docker compose up -d --build
docker compose exec api alembic upgrade head
```

---

## Règle d'or

**Un secret committé une fois reste dans l'historique Git pour
toujours**, même supprimé ensuite. D'où la vérification systématique.
Le `.env` ne doit JAMAIS être ajouté à Git — il est protégé par
`.gitignore`, ne force jamais son ajout (`git add -f .env` = interdit).
