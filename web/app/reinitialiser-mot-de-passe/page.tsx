"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="mx-auto max-w-md px-6 py-16">
            <p className="text-ink-muted">Chargement…</p>
          </main>
        }
      >
        <ResetForm />
      </Suspense>
    </>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }
    if (pwd !== pwd2) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: pwd }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur");
      }
      setDone(true);
      setTimeout(() => router.push("/connexion"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="rounded-lg bg-signal-light p-4 text-sm text-signal-dark">
          Lien invalide. Demandez un nouveau lien depuis la page « Mot de passe oublié ».
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
        Nouveau mot de passe
      </h1>

      {done ? (
        <div className="mt-8 rounded-2xl border border-line bg-paper p-6 text-sm text-ink-soft shadow-card">
          <p>Mot de passe modifié. Redirection vers la connexion…</p>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="mt-8 space-y-5 rounded-2xl border border-line bg-paper p-6 shadow-card"
        >
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Confirmer
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {busy ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      )}
    </main>
  );
}
