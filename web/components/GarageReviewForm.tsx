"use client";

import { useState } from "react";
import { authFetch, useCurrentUser } from "@/lib/auth";

export function GarageReviewForm({ garageId }: { garageId: string }) {
  const { user, loading } = useCurrentUser();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;

  if (!user) {
    return (
      <p className="mt-3 text-sm text-ink-muted">
        <a href="/connexion" className="font-semibold text-signal hover:underline">
          Connectez-vous
        </a>{" "}
        pour laisser un avis (réservé aux clients ayant commandé ici).
      </p>
    );
  }

  if (state === "done") {
    return (
      <p className="mt-3 rounded-lg bg-ok/10 px-4 py-3 text-sm font-semibold text-ok">
        Merci pour votre avis !
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await authFetch(`/garages/${garageId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.detail || "Envoi impossible");
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-line bg-paper p-4">
      <p className="mb-2 text-sm font-semibold text-ink">Laisser un avis</p>
      {error && <p className="mb-2 text-sm text-signal">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-ink-soft">
          Note
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="ml-2 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-signal"
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} ★
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Votre commentaire (optionnel)"
        className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="mt-2 rounded-lg bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-60"
      >
        {state === "sending" ? "Envoi…" : "Publier mon avis"}
      </button>
    </form>
  );
}
