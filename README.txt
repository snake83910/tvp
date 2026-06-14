============================================================
ÉTAPE 1/2 : COMMANDES DANS L'ESPACE CLIENT
============================================================

Cette archive contient tout pour que le client puisse :
- voir la liste de ses commandes depuis /compte
- consulter le détail d'une commande sur /commandes/{numero}

L'étape 2 (emails) sera livrée séparément.


============================================================
CONTENU DE L'ARCHIVE
============================================================

  INSTRUCTIONS_BACKEND.txt
  INSTRUCTIONS_LIB_AUTH.ts
  web/app/compte/page.tsx                       (à remplacer)
  web/app/commandes/[orderNumber]/page.tsx      (nouveau)


============================================================
MARCHE À SUIVRE (dans l'ordre)
============================================================

[1] Décompresse l'archive à la racine du projet (C:\Users\remy1\Projets\tvp)
    Les pages web/ se mettent au bon endroit, écrasant l'ancien /compte.
    Le dossier /commandes/[orderNumber]/ est nouveau, il est créé.

[2] Lis INSTRUCTIONS_BACKEND.txt et applique les 2 modifs Python :
    - MODIF 1 : ajouts dans api/app/schemas/order.py
    - MODIF 2 : ajouts dans api/app/modules/accounts/router.py
    ATTENTION : les blocs de code sont entre triple-quotes pour
    pouvoir être affichés. Quand tu copies dans tes fichiers
    Python, ne copie PAS les triple-quotes ouvrantes/fermantes.

[3] Lis INSTRUCTIONS_LIB_AUTH.ts et ajoute les interfaces +
    méthodes dans ton web/lib/auth.ts.
    Pareil : ne pas copier les /* */ qui entourent les blocs.

[4] Redémarre tout :
       cd C:\Users\remy1\Projets\tvp
       docker compose restart api
       docker compose restart web      (ou up -d --build web)

[5] Teste :
    - Connecte-toi
    - Va sur /compte
    - Tu dois voir la liste de tes commandes (au moins celle de TVP-3BF60BE5 du test précédent)
    - Clique sur "Détail →"
    - Tu arrives sur /commandes/TVP-XXXXXXXX avec tous les détails

[6] Quand c'est OK chez toi, signale-le et on enchaîne sur les emails.
