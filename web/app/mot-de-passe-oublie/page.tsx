"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch(`${BROWSER_API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setBusy(false);
      setDone(true); // Toujours afficher le même message (anti-énumération)
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Mot de passe oublié
        </h1>
        {done ? (
          <div className="mt-8 rounded-2xl border border-line bg-paper p-6 text-sm text-ink-soft shadow-card">
            <p>
              Si un compte existe pour cette adresse, un email contenant un lien
              de réinitialisation vient d&apos;être envoyé. Vérifiez aussi
              votre dossier indésirables.
            </p>
            <p className="mt-3 text-xs text-ink-muted">
              Le lien est valide 15 minutes.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 space-y-5 rounded-2xl border border-line bg-paper p-6 shadow-card"
          >
            <p className="text-sm text-ink-soft">
              Saisissez l&apos;adresse email associée à votre compte. Vous
              recevrez un lien pour choisir un nouveau mot de passe.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
            >
              {busy ? "Envoi…" : "Envoyer le lien"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
