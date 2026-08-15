"use client";

import { useEffect, useState } from "react";
import { partnerApi, type PartnerReview } from "@/lib/partner";
import { TabHeader } from "@/components/garage/ui";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" role="img" aria-label={`${rating} sur 5`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-line-strong">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}

export function AvisTab() {
  const [reviews, setReviews] = useState<PartnerReview[] | null>(null);

  useEffect(() => {
    partnerApi.listReviews().then(setReviews).catch(() => setReviews([]));
  }, []);

  if (reviews === null) {
    return <p className="text-ink-muted">Chargement…</p>;
  }

  const avg =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div>
      <TabHeader
        title="Avis clients"
        subtitle="Les avis laissés par vos clients après leur montage."
      />

      {reviews.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-6 text-ink-muted">
          Aucun avis pour le moment.
        </p>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3">
            <span className="font-display text-3xl font-black text-ink">
              {avg.toFixed(1)}
            </span>
            <div>
              <Stars rating={avg} />
              <p className="text-xs text-ink-muted">
                {reviews.length} avis
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-paper p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{r.author_name}</span>
                  <Stars rating={r.rating} />
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>
                )}
                <p className="mt-1 text-xs text-ink-muted">
                  {new Date(r.created_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
