// Section « engagements ». Remplace les anciens témoignages clients, qui
// étaient inventés : publier de faux avis (ou un compteur de clients
// fictif) est une pratique commerciale trompeuse — art. L.121-2 et
// L.121-4 du code de la consommation. Tant qu'on n'a pas d'avis réels
// collectés et vérifiables, on met en avant des engagements que le code
// tient réellement, pas de la preuve sociale fabriquée.
//
// Quand les vrais avis existeront : les servir depuis la base (comme
// GarageReviews), avec la date et la commande rattachée.

const COMMITMENTS = [
  {
    title: "Le prix affiché est le prix payé",
    // Vérifié au checkout : revalidation du prix fournisseur, commande
    // bloquée en cas d'écart (cf. cart/service.py).
    text:
      "Nos tarifs sont recalculés en direct sur le catalogue fournisseur. " +
      "Au moment de valider, le prix est revérifié : en cas d'écart, la " +
      "commande est bloquée plutôt que débitée au mauvais montant.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path d="M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Vos données bancaires ne nous sont jamais transmises",
    // Formulaire hébergé Sogecommerce : le numéro de carte ne transite
    // pas par nos serveurs (cf. integrations/payment.py).
    text:
      "Le paiement se fait sur le formulaire hébergé de Sogecommerce " +
      "(Société Générale). Votre numéro de carte ne passe pas par nos " +
      "serveurs et n'y est jamais enregistré.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Livrés chez vous ou montés chez un partenaire",
    text:
      "Livraison à domicile, ou expédition directe au garage partenaire " +
      "de votre choix pour un montage clé en main. Vous choisissez au " +
      "moment de la commande.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11z" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
];

export function Commitments() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
          Nos engagements
        </p>
        <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Acheter des pneus sans mauvaise surprise
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {COMMITMENTS.map((c) => (
          <div
            key={c.title}
            className="flex flex-col rounded-2xl border border-line bg-paper p-6 shadow-card"
          >
            <span className="text-signal">{c.icon}</span>
            <h3 className="mt-4 font-display text-base font-bold text-ink">
              {c.title}
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
              {c.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
