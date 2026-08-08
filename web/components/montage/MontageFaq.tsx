"use client";

import { useState } from "react";

const QA = [
  {
    q: "Combien coûte le montage des pneus ?",
    a: "Le montage est réglé directement au garage partenaire, selon sa grille de tarifs affichée sur sa page. Vous connaissez le prix de la prestation avant de valider votre rendez-vous : aucune surprise, aucun frais caché de notre côté.",
  },
  {
    q: "Comment se passe la prise de rendez-vous ?",
    a: "Au moment de la commande, choisissez « Montage chez un garage partenaire » puis sélectionnez le garage le plus proche. Vos pneus y sont livrés directement et vous convenez de la date de montage avec le garage.",
  },
  {
    q: "Que comprend la prestation de montage ?",
    a: "Le montage et démontage des roues, l'équilibrage, le remplacement des valves, le contrôle de la pression et le serrage au couple. Le détail exact des prestations est indiqué sur la page de chaque garage partenaire.",
  },
  {
    q: "Puis-je quand même me faire livrer à domicile ?",
    a: "Oui. Le montage en garage est une option : vous pouvez toujours choisir la livraison à domicile et faire monter vos pneus par le professionnel de votre choix.",
  },
  {
    q: "Que deviennent mes pneus usagés ?",
    a: "Les garages partenaires assurent la reprise et le recyclage de vos anciens pneus dans le respect de la réglementation environnementale.",
  },
  {
    q: "Comment sont sélectionnés les garages partenaires ?",
    a: "Chaque garage est un professionnel indépendant vérifié (SIRET contrôlé) avant publication de sa page. Les avis clients laissés après montage vous aident à choisir en confiance.",
  },
];

export function MontageFaq() {
  const [open, setOpen] = useState<number | null>(0);

  // JSON-LD FAQ pour Google
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QA.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal-dark">
          Questions fréquentes
        </p>
        <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Le montage en garage, en clair
        </h2>
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
        {QA.map((it, i) => {
          const isOpen = open === i;
          return (
            <div key={i}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-paper-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:-ring-offset-1"
                aria-expanded={isOpen}
              >
                <span className="font-display text-base font-bold text-ink">{it.q}</span>
                <span className={`text-2xl text-ink-muted transition ${isOpen ? "rotate-45 text-signal" : ""}`}>+</span>
              </button>
              {isOpen && (
                <div className="px-6 pb-5 text-sm leading-relaxed text-ink-soft">
                  {it.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
