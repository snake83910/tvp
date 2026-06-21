"use client";

import { useState } from "react";

const QA = [
  {
    q: "Quels sont les délais de livraison ?",
    a: "Entre 48 et 72h en France métropolitaine pour la plupart des références. Vous recevez un email avec le numéro de suivi dès l'expédition.",
  },
  {
    q: "Puis-je faire monter mes pneus chez un garage partenaire ?",
    a: "Oui, vous pouvez choisir un garage partenaire au moment de la commande. Le pneu y est livré directement et le rendez-vous est pris pour le montage.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Cartes bancaires Visa, Mastercard, CB. Le paiement est traité par Société Générale Sogecommerce. Aucune donnée bancaire n'est conservée sur notre site.",
  },
  {
    q: "Comment trouver la bonne dimension de pneu ?",
    a: "La dimension est inscrite sur le flanc du pneu (ex : 205/55 R16 91V). Vous pouvez aussi entrer votre plaque d'immatriculation, nous récupérons automatiquement les dimensions homologuées pour votre véhicule.",
  },
  {
    q: "Puis-je retourner mes pneus ?",
    a: "Vous disposez d'un délai légal de rétractation de 14 jours à compter de la réception. Les pneus doivent être non montés et dans leur état d'origine.",
  },
  {
    q: "Proposez-vous des prix pro / B2B ?",
    a: "Oui, créez un compte professionnel en renseignant votre SIRET. Vous accédez à des tarifs HT et à une facturation adaptée.",
  },
];

export function Faq() {
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
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-signal">
          Questions fréquentes
        </p>
        <h2 className="font-display text-3xl font-black tracking-tightest text-ink md:text-4xl">
          Tout ce que vous voulez savoir
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
