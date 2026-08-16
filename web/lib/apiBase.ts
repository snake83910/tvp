/**
 * Adresse de l'API — un seul endroit.
 *
 * Elle était recopiée dans huit fichiers, chacun avec son propre repli
 * `|| "http://localhost:8000"`. Il a suffi d'y ajouter la version pour
 * que la duplication devienne un risque : en oublier un, c'est un écran
 * qui appelle une route disparue.
 *
 * Le numéro de version est mis ICI et pas dans les variables
 * d'environnement : c'est un fait du CODE (les chemins qu'il appelle),
 * pas une donnée de déploiement. Le jour d'une v2, on change cette
 * constante avec les appels correspondants, dans le même commit.
 */
export const API_VERSION = "v1";

/** Racine sans version. SSR : réseau interne Docker. Navigateur : URL
 *  publique, proxifiée par la réécriture `/api/*` de Next. */
function root(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL_INTERNAL || "http://api:8000";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

/** Base à préfixer aux chemins de l'API produit (`/cart`, `/auth/…`). */
export function apiBase(): string {
  return `${root()}/${API_VERSION}`;
}

/** Base des routes NON versionnées, volontairement : `/health` pour les
 *  sondes, `/payment/ipn` déclarée chez la banque. */
export function apiRoot(): string {
  return root();
}

/** Base TOUJOURS publique, même rendue côté serveur.
 *
 *  Indispensable pour une URL destinée au NAVIGATEUR — un `src` d'image,
 *  un lien. `apiBase()` renverrait alors l'adresse interne Docker
 *  (`http://api:8000`), injoignable depuis l'extérieur : les photos de
 *  garage ne s'afficheraient plus.
 */
export function publicApiBase(): string {
  return `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/${API_VERSION}`;
}
