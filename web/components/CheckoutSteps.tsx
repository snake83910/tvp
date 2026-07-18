import Link from "next/link";

const STEPS = [
  { n: 1, label: "Panier", href: "/panier" },
  { n: 2, label: "Livraison", href: "/checkout" },
  { n: 3, label: "Paiement", href: null },
] as const;

/** Fil d'Ariane du tunnel : l'utilisateur sait où il est et ce qui reste. */
export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Étapes de la commande" className="mb-8">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => {
          const done = s.n < current;
          const active = s.n === current;
          const content = (
            <span
              className={`flex items-center gap-2 ${
                active
                  ? "font-bold text-signal"
                  : done
                    ? "font-semibold text-ink"
                    : "text-ink-muted"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  active
                    ? "bg-signal text-white"
                    : done
                      ? "bg-ink text-paper"
                      : "border border-line text-ink-muted"
                }`}
              >
                {done ? "✓" : s.n}
              </span>
              {s.label}
            </span>
          );
          return (
            <li key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="mx-1 h-px w-6 bg-line" aria-hidden />}
              {done && s.href ? (
                <Link href={s.href} className="transition hover:text-signal">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
