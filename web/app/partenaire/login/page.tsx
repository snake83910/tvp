"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth, clearTokens } from "@/lib/auth";
import { PasswordField } from "@/components/PasswordField";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.login(email, password);
      const me = await auth.me();
      if (me.role !== "garage") {
        // Compte non partenaire : on ne le laisse pas entrer par cette porte.
        clearTokens();
        setError(
          "Ce compte n'est pas un compte partenaire. Utilisez la connexion client.",
        );
        setBusy(false);
        return;
      }
      router.push("/partenaire");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal">
          Espace partenaire
        </p>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tightest text-ink">
          Connexion garage
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Réservé aux garages partenaires pour gérer leur page et leurs
          commandes.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
              {error}
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-signal"
            />
          </div>
          <PasswordField
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Pas encore partenaire ?{" "}
          <Link href="/partenaire/inscription" className="font-semibold text-signal hover:underline">
            Créer un compte
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-ink-muted">
          Vous êtes un particulier ?{" "}
          <Link href="/connexion" className="hover:text-signal hover:underline">
            Connexion client
          </Link>
        </p>
      </div>
    </main>
  );
}
