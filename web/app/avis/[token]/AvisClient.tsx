"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Stars } from "@/components/Stars";
import { apiBase } from "@/lib/apiBase";
import { errorMessage } from "@/lib/errors";

interface Item {
  supplier_ref: string;
  label: string;
  already_reviewed: boolean;
}

interface Contexte {
  order_number: string;
  items: Item[];
}

type Notes = Record<string, { rating: number; comment: string }>;

export function AvisClient({ token }: { token: string }) {
  const [ctx, setCtx] = useState<Contexte | null>(null);
  const [notes, setNotes] = useState<Notes>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`${apiBase()}/reviews/context?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.message ?? b.detail ?? "Lien invalide");
        return b as Contexte;
      })
      .then(setCtx)
      .catch((e) => setError(errorMessage(e, "Lien invalide")))
      .finally(() => setLoading(false));
  }, [token]);

  const aNoter = ctx?.items.filter((i) => !i.already_reviewed) ?? [];
  const remplies = aNoter.filter((i) => notes[i.supplier_ref]?.rating);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          reviews: remplies.map((i) => ({
            supplier_ref: i.supplier_ref,
            rating: notes[i.supplier_ref].rating,
            comment: notes[i.supplier_ref].comment || null,
          })),
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.message ?? b.detail ?? "Envoi impossible");
      setDone(true);
    } catch (e) {
      setError(errorMessage(e, "Envoi impossible"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        {loading ? (
          <p className="text-ink-muted">Chargement…</p>
        ) : done ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <h1 className="font-display text-2xl font-black text-ink">
              Merci ✓
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Votre avis est publié. Il aidera les prochains acheteurs à
              choisir.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white hover:bg-signal-dark"
            >
              Retour à la boutique
            </Link>
          </div>
        ) : !ctx ? (
          <div className="rounded-2xl border border-signal/40 bg-signal-light p-6">
            <p className="font-semibold text-signal-dark">
              Ce lien ne fonctionne pas
            </p>
            <p className="mt-1 text-sm text-ink-soft">{error}</p>
          </div>
        ) : aNoter.length === 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <h1 className="font-display text-2xl font-black text-ink">
              C&apos;est déjà fait
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Vous avez donné votre avis sur cette commande. Merci&nbsp;!
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
              Votre avis sur vos pneus
            </h1>
            <p className="mt-2 text-ink-soft">
              Commande {ctx.order_number}. Notez ce que vous voulez, laissez
              le reste de côté.
            </p>

            <div className="mt-8 space-y-5">
              {aNoter.map((item) => {
                const note = notes[item.supplier_ref];
                return (
                  <div
                    key={item.supplier_ref}
                    className="rounded-2xl border border-line bg-paper p-6 shadow-card"
                  >
                    <p className="font-semibold text-ink">{item.label}</p>
                    <div className="mt-3">
                      <Stars
                        value={note?.rating ?? 0}
                        label={`Note pour ${item.label}`}
                        onChange={(n) =>
                          setNotes((prev) => ({
                            ...prev,
                            [item.supplier_ref]: {
                              rating: n,
                              comment: prev[item.supplier_ref]?.comment ?? "",
                            },
                          }))
                        }
                      />
                    </div>
                    {note?.rating ? (
                      <textarea
                        value={note.comment}
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [item.supplier_ref]: {
                              ...prev[item.supplier_ref],
                              comment: e.target.value,
                            },
                          }))
                        }
                        rows={3}
                        maxLength={2000}
                        placeholder="Tenue de route, bruit, usure… ce que vous auriez aimé lire avant d'acheter. (facultatif)"
                        className="mt-3 w-full rounded-lg border border-line bg-paper p-3 text-sm text-ink outline-none transition focus:border-signal"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-6 rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark"
              >
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={busy || remplies.length === 0}
              className="mt-6 rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-40"
            >
              {busy
                ? "Envoi…"
                : `Publier ${remplies.length > 1 ? "mes avis" : "mon avis"}`}
            </button>

            <p className="mt-4 text-xs text-ink-muted">
              Votre avis paraît sous la forme «&nbsp;Prénom I.&nbsp;», avec sa
              date. Nous publions les bons comme les mauvais&nbsp;: seuls les
              propos injurieux ou illégaux sont retirés.
            </p>
          </>
        )}
      </main>
    </>
  );
}
