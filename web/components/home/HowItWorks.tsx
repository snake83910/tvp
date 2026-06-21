const STEPS = [
  {
    n: "01",
    title: "Trouvez vos pneus",
    body: "Par plaque ou par dimensions. Notre catalogue regroupe des milliers de références au meilleur prix.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Commandez en 2 minutes",
    body: "Paiement 100% sécurisé par carte bancaire via Société Générale. Validation immédiate par email.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Recevez ou faites monter",
    body: "Livraison à domicile sous 48-72h, ou directement chez l'un de nos garages partenaires pour un montage clé en main.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
          Comment ça marche
        </p>
        <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Trois étapes, pas une de plus
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="relative rounded-2xl border border-line bg-paper p-7 shadow-card transition hover:border-signal hover:shadow-lift"
          >
            <span className="absolute right-5 top-5 font-display text-3xl font-black text-paper-dim">
              {s.n}
            </span>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-signal-light text-signal">
              {s.icon}
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-ink">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
