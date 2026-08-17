import { Stars } from "@/components/Stars";
import { apiBase } from "@/lib/apiBase";

export interface ReviewsBlock {
  count: number;
  average: number;
  reviews: {
    author_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }[];
}

/** Lu côté serveur : les avis doivent être DANS le HTML rendu.
 *
 *  Chargés en JavaScript après coup, ils n'existeraient pas pour un
 *  robot d'indexation — or c'est précisément l'indexation qu'on vise
 *  avec le balisage AggregateRating. `no-store` : un avis publié doit
 *  apparaître tout de suite, sinon son auteur croit l'avoir perdu.
 */
export async function fetchReviews(
  supplierRef: string,
): Promise<ReviewsBlock | null> {
  try {
    const r = await fetch(
      `${apiBase()}/reviews/product/${encodeURIComponent(supplierRef)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    return (await r.json()) as ReviewsBlock;
  } catch {
    // Les avis sont un plus : leur absence ne doit pas faire tomber une
    // fiche produit, qui reste avant tout une page de vente.
    return null;
  }
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ProductReviews({ block }: { block: ReviewsBlock | null }) {
  if (!block) return null;

  return (
    <section id="avis" className="mt-12 border-t border-line pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-black text-ink">
          Avis clients
        </h2>
        {block.count > 0 && (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Stars value={block.average} />
            <span className="font-bold text-ink">
              {block.average.toFixed(1).replace(".", ",")}/5
            </span>
            <span>
              · {block.count} avis
            </span>
          </p>
        )}
      </div>

      {/* Mention obligatoire (art. L111-7-2 du code de la consommation) :
          on doit dire si les avis sont contrôlés et comment. Elle est
          adossée à un fait technique — le formulaire n'existe qu'au bout
          d'un lien envoyé après livraison — pas à une promesse. */}
      <p className="mt-2 text-xs text-ink-muted">
        Avis vérifiés : seuls les clients ayant reçu leur commande sont
        invités à en déposer un, par un lien personnel envoyé par email.
        Aucun avis n&apos;est acheté ni sollicité contre contrepartie. Nous
        publions les avis négatifs comme les positifs&nbsp;; seuls les
        propos injurieux ou illégaux sont retirés.
      </p>

      {block.count === 0 ? (
        <p className="mt-6 rounded-xl bg-paper-dim p-5 text-sm text-ink-soft">
          Pas encore d&apos;avis sur ce modèle. Les premiers arriveront
          quelques jours après les premières livraisons.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {block.reviews.map((r, i) => (
            <li
              key={i}
              className="rounded-xl border border-line bg-paper p-5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} size={15} />
                <span className="text-sm font-bold text-ink">
                  {r.author_name}
                </span>
                {/* La date est obligatoire : sans elle, un avis ancien
                    passe pour récent. */}
                <time
                  dateTime={r.created_at}
                  className="text-xs text-ink-muted"
                >
                  {dateCourte(r.created_at)}
                </time>
              </div>
              {r.comment && (
                <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">
                  {r.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
