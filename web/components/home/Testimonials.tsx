const REVIEWS = [
  {
    name: "Sophie L.",
    location: "Marseille",
    rating: 5,
    text: "Commande passée le mardi, livrée à mon garage le vendredi. Prix imbattable comparé à mon ancien fournisseur.",
    product: "Michelin Primacy 4",
  },
  {
    name: "Karim B.",
    location: "Lyon",
    rating: 5,
    text: "Recherche par plaque ultra simple, j'ai trouvé mes pneus en 30 secondes. Service après-vente très réactif.",
    product: "Continental EcoContact 6",
  },
  {
    name: "Émilie R.",
    location: "Paris",
    rating: 4,
    text: "Bon rapport qualité/prix. Petit délai supplémentaire sur ma commande, mais une équipe disponible qui m'a tenue informée.",
    product: "Goodyear EfficientGrip",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Note : ${n} sur 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          fill={i < n ? "#f5a623" : "#e3e1d8"}
          className="h-4 w-4"
        >
          <path d="M10 1l2.6 5.7 6.4.7-4.7 4.5 1.3 6.4L10 15l-5.6 3.3L5.7 12 1 7.4l6.4-.7L10 1z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
          Ils nous font confiance
        </p>
        <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Plus de 10 000 clients satisfaits
        </h2>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {REVIEWS.map((r) => (
          <figure
            key={r.name}
            className="flex flex-col rounded-2xl border border-line bg-paper p-6 shadow-card"
          >
            <Stars n={r.rating} />
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink-soft">
              « {r.text} »
            </blockquote>
            <figcaption className="mt-5 border-t border-line pt-4">
              <p className="text-sm font-bold text-ink">{r.name}</p>
              <p className="text-xs text-ink-muted">
                {r.location} · {r.product}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
