"use client";

/**
 * Déclenche l'enregistrement d'un blob comme fichier.
 *
 * Deux pièges que la version naïve (créer un <a>, cliquer, révoquer)
 * ne passe pas :
 *
 *  - Firefox ignore un clic sur un <a> qui n'est pas dans le document.
 *    Chrome le tolère, d'où un bug qui ne se voit pas partout : le clic
 *    ne fait alors STRICTEMENT rien, sans erreur.
 *  - révoquer l'URL juste après le clic annule le téléchargement en
 *    cours : le navigateur n'a pas encore lu le blob. On laisse le GC
 *    faire son travail un peu plus tard.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Message d'erreur lisible pour un téléchargement de facture raté. */
export function invoiceError(status: number): string {
  if (status === 401 || status === 403)
    return "Session expirée : reconnectez-vous pour télécharger la facture.";
  if (status === 404) return "Facture introuvable pour cette commande.";
  return `Impossible de télécharger la facture (erreur ${status}).`;
}
