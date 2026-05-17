"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";

export default function LoginPage() {
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
      router.push("/compte");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Connexion impossible",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Connexion
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Accédez à vos commandes et adresses.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5 rounded-2xl border border-line bg-paper p-6 shadow-card"
        >
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
              {error}
            </p>
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
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
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-semibold text-signal hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </main>
    </>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
    </div>
  );
}
