# Configuration DNS pour les emails — IONOS

Sans cette configuration, tes emails passent en spam chez Gmail
(majorité de tes clients), Outlook et Yahoo. C'est devenu obligatoire
depuis février 2024 — sans SPF/DKIM/DMARC, Gmail rejette ou marque en
spam les domaines non authentifiés. **À faire avant d'envoyer le
premier vrai email.**

Le tout prend 15-20 minutes dans ton espace IONOS.

---

## Vue d'ensemble : SPF, DKIM, DMARC

Trois enregistrements DNS à ajouter pour `tousvospneus.com`. Chacun
résout un problème différent :

| Enregistrement | À quoi ça sert |
|---|---|
| **SPF** | Dit "voici les serveurs autorisés à envoyer pour mon domaine" |
| **DKIM** | Signe cryptographiquement chaque email envoyé |
| **DMARC** | Politique : que faire si SPF ou DKIM échoue (rejeter / spam / accepter) |

Bonne nouvelle : tu utilises **smtp.ionos.fr** pour envoyer, ce qui
veut dire que la plupart des enregistrements sont déjà fournis par
IONOS, il suffit de les activer.

---

## Étape 1 — Connecte-toi à IONOS

1. Va sur **ionos.fr** et connecte-toi
2. Menu **Domaines & SSL** → trouve `tousvospneus.com`
3. Clique sur le domaine pour ouvrir sa fiche
4. Onglet **DNS** (ou "Paramètres DNS")

Tu vois la liste des enregistrements DNS actuels. On va en ajouter
ou modifier trois.

---

## Étape 2 — SPF

Cherche un enregistrement TXT existant à la racine (Hôte = `@` ou
vide) qui commence par `v=spf1`.

### Cas A : il n'existe pas encore

Ajoute un nouvel enregistrement :

| Champ | Valeur |
|---|---|
| **Type** | TXT |
| **Hôte / Nom** | `@` (ou laisser vide) |
| **Valeur** | `v=spf1 include:_spf.perfora.net include:_spf.kundenserver.de ~all` |
| **TTL** | 3600 (défaut) |

(`_spf.perfora.net` et `_spf.kundenserver.de` sont les serveurs SMTP
IONOS officiels. La valeur `~all` veut dire "marque comme suspect tout
ce qui n'est pas listé" — c'est la valeur recommandée pour démarrer.)

### Cas B : il existe déjà

Modifie l'existant pour qu'il ressemble à la valeur ci-dessus. **Ne
PAS en créer un second** : un seul SPF par domaine, sinon les
vérifications échouent.

---

## Étape 3 — DKIM

IONOS gère DKIM automatiquement à condition de l'activer. Dans
l'interface IONOS :

1. Menu **Email** → ton compte `serviceclient@tousvospneus.com`
2. Cherche la section **DKIM** ou **Authentification email** (le nom
   varie selon les versions de l'interface)
3. Active DKIM pour `tousvospneus.com`
4. IONOS te donne un nom + une valeur d'enregistrement (souvent
   `s1._domainkey` avec une longue clé publique)

Si tu trouves l'option, c'est en un clic — IONOS ajoute lui-même
l'enregistrement DNS. Si tu ne la trouves pas, contacte le support
IONOS (chat ou tél), ils l'activent en 5 minutes.

**Pour vérifier que DKIM est actif** une fois configuré, utilise :
- https://www.mail-tester.com (envoie un mail à l'adresse qu'ils
  donnent, ils te disent où ça pèche)

---

## Étape 4 — DMARC

Ajoute un nouvel enregistrement DNS :

| Champ | Valeur |
|---|---|
| **Type** | TXT |
| **Hôte / Nom** | `_dmarc` |
| **Valeur** | `v=DMARC1; p=none; rua=mailto:serviceclient@tousvospneus.com; pct=100` |
| **TTL** | 3600 |

Décodage :
- `p=none` : politique d'observation seulement (pour démarrer). Plus
  tard, quand tu auras vérifié que tes emails passent SPF+DKIM
  correctement, tu pourras passer à `p=quarantine` (envoie en spam les
  emails non conformes) puis `p=reject` (rejette purement).
- `rua=mailto:...` : reçoit les rapports d'agrégation des serveurs
  mail destinataires (Gmail, Outlook envoient un rapport quotidien)
- `pct=100` : applique la politique à 100% des emails

---

## Étape 5 — Vérifier que tout est en place

Après avoir ajouté ces enregistrements, attends 10 à 30 minutes (le
DNS se propage), puis vérifie :

### Test 1 : SPF + DKIM + DMARC déclarés
- https://mxtoolbox.com/SuperTool.aspx
- Tape `tousvospneus.com` et fais "SPF Record Lookup", puis "DMARC
  Lookup", puis "DKIM Lookup"
- Tu dois voir tes 3 enregistrements

### Test 2 : envoi réel scoré
- Va sur https://www.mail-tester.com
- Copie l'adresse qu'ils te donnent (un truc du genre
  `test-xxx@srv1.mail-tester.com`)
- Depuis ton compte `serviceclient@tousvospneus.com`, envoie un email
  à cette adresse (peu importe le contenu)
- Reviens sur mail-tester.com et clique "Vérifier mon score"
- Tu dois avoir **8 ou 9 sur 10**. Si moins, ils t'expliquent ce qui
  manque.

---

## Erreurs courantes

**"DKIM not signed"** — DKIM pas activé chez IONOS, ou pas encore
propagé (attends 30 min après activation).

**"SPF softfail"** — il y a un SPF mais il n'inclut pas IONOS. Vérifie
que `include:_spf.perfora.net` est bien dans ta valeur.

**"Multiple SPF records"** — tu as ajouté un deuxième SPF au lieu de
modifier l'existant. Supprime-en un.

**Score 5 ou 6 sur mail-tester** — souvent le DKIM qui manque. C'est
l'enregistrement le plus difficile à activer manuellement, mais une
fois fait c'est définitif.

---

## Plus tard : passer DMARC en mode strict

Pendant 2-4 semaines, laisse `p=none` et regarde les rapports
d'agrégation que tu recevras à `serviceclient@tousvospneus.com`. Une
fois sûr que 100% de tes emails passent SPF+DKIM, modifie ton DMARC
en :

```
v=DMARC1; p=quarantine; rua=mailto:serviceclient@tousvospneus.com; pct=100
```

Puis quelques semaines plus tard, en :

```
v=DMARC1; p=reject; rua=mailto:serviceclient@tousvospneus.com; pct=100
```

C'est le niveau de sécurité maximal — personne ne peut usurper ton
domaine pour spammer.
