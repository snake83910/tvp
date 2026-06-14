import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Conditions générales de vente — tousvospneus.com",
};

export default function CGVPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl border-2 border-signal bg-signal-light p-4 text-sm">
          <p className="font-bold text-signal-dark">
            ⚠ DOCUMENT NON CONTRACTUEL — À REMPLACER AVANT MISE EN
            LIGNE
          </p>
          <p className="mt-1 text-ink-soft">
            Ces CGV sont un placeholder permettant aux tests fonctionnels
            du site. Elles doivent être rédigées par un avocat ou via
            un service spécialisé (Captain Contrat, LegalPlace…) avant
            d&apos;encaisser le premier paiement réel. Vente en ligne
            sans CGV valides = infraction au code de la consommation
            (article L221-5).
          </p>
        </div>

        <h1 className="mt-8 font-display text-3xl font-black tracking-tightest text-ink">
          Conditions générales de vente
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          tousvospneus.com — SAS · SIREN 977 671 965 · TVA FR38 977
          671 965 — 35 B Chemin des Beaumouilles, 13710 Fuveau
        </p>

        <Section title="Article 1 — Objet">
          Les présentes conditions générales régissent les ventes de
          pneumatiques effectuées via le site tousvospneus.com.
        </Section>
        <Section title="Article 2 — Prix">
          Les prix sont indiqués en euros TTC pour les particuliers,
          HT pour les professionnels. Ils sont garantis au moment du
          paiement après revalidation contre le catalogue fournisseur.
        </Section>
        <Section title="Article 3 — Livraison">
          Livraison à domicile en France métropolitaine. Frais gratuits
          si chaque référence est commandée à 2 pneus minimum, sinon
          6,90 € HT (8,28 € TTC). Délai indicatif 3 à 7 jours ouvrés.
        </Section>
        <Section title="Article 4 — Paiement">
          Paiement sécurisé par carte bancaire via Sogecommerce
          (Société Générale). Aucune donnée bancaire n&apos;est stockée
          sur nos serveurs.
        </Section>
        <Section title="Article 5 — Droit de rétractation">
          Conformément au code de la consommation, le client dispose
          de 14 jours à compter de la livraison pour exercer son droit
          de rétractation, sans avoir à justifier sa décision.
        </Section>
        <Section title="Article 6 — Garanties">
          Les pneumatiques bénéficient de la garantie légale de
          conformité (2 ans) et de la garantie des vices cachés.
        </Section>
        <Section title="Article 7 — Données personnelles">
          Les informations recueillies sont nécessaires au traitement
          de la commande. Conformément au RGPD, vous disposez d&apos;un
          droit d&apos;accès, de rectification et de suppression.
        </Section>
        <Section title="Article 8 — Litiges">
          Les présentes CGV sont régies par le droit français.
        </Section>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold text-ink">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {children}
      </p>
    </section>
  );
}
