"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  PasswordField,
  passwordMeetsRules,
} from "@/components/PasswordField";
import { auth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function up(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Mêmes règles que le backend : évite un aller-retour pour rien
    if (!passwordMeetsRules(form.password)) {
      setError(
        "Le mot de passe ne respecte pas encore toutes les règles ci-dessous.",
      );
      return;
    }
    setBusy(true);
    try {
      await auth.register(form);
      await auth.login(form.email, form.password);
      router.push("/compte");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Inscription impossible",
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
          Créer un compte
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pour suivre vos commandes et gagner du temps au paiement.
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
          <div className="grid grid-cols-2 gap-4">
            <F label="Prénom" v={form.first_name} k="first_name" up={up} />
            <F label="Nom" v={form.last_name} k="last_name" up={up} />
          </div>
          <F label="Email" type="email" v={form.email} k="email" up={up} />
          <PasswordField
            label="Mot de passe"
            value={form.password}
            onChange={(v) => up("password", v)}
            autoComplete="new-password"
            showChecklist
          />
          <F label="Téléphone" v={form.phone} k="phone" up={up} />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {busy ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Déjà client ?{" "}
          <Link
            href="/connexion"
            className="font-semibold text-signal hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </main>
    </>
  );
}

function F({
  label,
  v,
  k,
  up,
  type = "text",
  hint,
}: {
  label: string;
  v: string;
  k: string;
  up: (k: string, v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required={k !== "phone"}
        value={v}
        onChange={(e) => up(k, e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
      {hint && (
        <p className="mt-1 text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
