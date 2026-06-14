import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Politique de confidentialité | Tous Vos Pneus",
  description: "Politique de confidentialité et traitement des données personnelles",
};

export default function ConfidentialitePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Dernière mise à jour : <strong>[date]</strong>
        </p>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-ink-soft">
          <section>
            <h2 className="font-display text-lg font-bold text-ink">Responsable du traitement</h2>
            <p>
              [À COMPLÉTER — raison sociale], dont le siège social est situé à [adresse],
              est responsable du traitement des données personnelles collectées sur le site
              tousvospneus.com.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Données collectées</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>Email, mot de passe (haché bcrypt) — création de compte</li>
              <li>Nom, prénom, téléphone — facturation / livraison</li>
              <li>Adresse(s) postale(s) — livraison</li>
              <li>Historique des commandes — gestion clientèle</li>
              <li>SIRET, raison sociale (comptes pro) — facturation B2B</li>
              <li>Adresse IP, user-agent — sécurité (rate limiting, logs)</li>
            </ul>
            <p>
              <strong>Nous ne stockons jamais vos données bancaires</strong> : le paiement est
              géré directement par Sogecommerce (Société Générale).
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Finalités</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>Exécution du contrat de vente (base légale : contrat)</li>
              <li>Gestion de la facturation et obligations comptables (base légale : obligation légale, 10 ans)</li>
              <li>Sécurité du site (base légale : intérêt légitime)</li>
              <li>Information sur vos commandes (base légale : exécution du contrat)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Destinataires</h2>
            <p>
              Vos données sont accessibles à nos équipes internes ainsi qu&apos;à nos
              sous-traitants (hébergeur, prestataire de paiement Sogecommerce, fournisseur
              Maxityre, transporteur). Aucune revente à des tiers à des fins commerciales.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Durée de conservation</h2>
            <ul className="ml-6 list-disc space-y-1">
              <li>Compte client : durée d&apos;activité + 3 ans après dernière connexion</li>
              <li>Factures et données comptables : 10 ans (obligation légale)</li>
              <li>Logs techniques : 1 an</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Vos droits (RGPD)</h2>
            <p>Vous disposez à tout moment des droits suivants :</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Droit d&apos;accès, de rectification, d&apos;effacement</li>
              <li>Droit à la portabilité (export de vos données)</li>
              <li>Droit d&apos;opposition et de limitation du traitement</li>
              <li>Droit de réclamation auprès de la CNIL ({" "}
                <a href="https://www.cnil.fr" className="text-signal hover:underline">cnil.fr</a>)
              </li>
            </ul>
            <p>
              Pour exercer ces droits : depuis votre{" "}
              <a href="/compte" className="text-signal hover:underline">espace compte</a>{" "}
              (rubrique Données personnelles) ou par email à{" "}
              <a href="mailto:rgpd@tousvospneus.com" className="text-signal hover:underline">
                rgpd@tousvospneus.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-ink">Cookies</h2>
            <p>
              Nous utilisons uniquement les cookies strictement nécessaires au fonctionnement
              du site (session, panier). Aucun cookie publicitaire ou de tracking tiers
              n&apos;est déposé sans votre consentement.
            </p>
          </section>
        </article>

        <p className="mt-10 rounded-lg bg-paper-dim p-4 text-xs text-ink-muted">
          ⚠️ Ce document est un modèle. Faites-le valider par un DPO ou un juriste avant publication.
        </p>
      </main>
    </>
  );
}
