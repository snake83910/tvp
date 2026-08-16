"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthTabs } from "@/components/AuthTabs";
import { PasswordField } from "@/components/PasswordField";
import { auth } from "@/lib/auth";

export default function LoginPage() {
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
        <LoginForm />
      </Suspense>
    </>
  );
}

/**
 * Connexion UNIQUE, client comme partenaire.
 *
 * L'espace partenaire avait sa propre page : même appel `auth.login`,
 * même PasswordField, même carte — pour une seule différence de fond, un
 * REFUS. Un client arrivé par cette porte était éjecté avec « ce compte
 * n'est pas un compte partenaire », là où cette page-ci l'aurait
 * simplement conduit chez lui. On a donc supprimé du code ET une
 * friction.
 *
 * `?next=/partenaire` conserve l'habillage partenaire : c'est la même
 * porte, mais elle sait d'où l'on vient.
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/compte";
  const partnerContext = next.startsWith("/partenaire");
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
      if (me.role === "garage") {
        // Un compte garage va toujours à son espace, jamais à la boutique.
        router.push("/partenaire");
      } else {
        // Client entré par la porte partenaire : on le conduit chez lui
        // plutôt que vers un espace dont il serait rejeté à l'arrivée.
        router.push(partnerContext ? "/compte" : next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      {partnerContext && (
        <div className="mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal">
            Espace partenaire
          </p>
          <h1 className="mt-1 font-display text-2xl font-black tracking-tightest text-ink">
            Connexion garage
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gérez votre fiche, vos créneaux et vos commandes.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        {/* Les onglets renvoient vers l'inscription CLIENT : hors sujet
            quand on arrive de l'espace partenaire. */}
        {!partnerContext && <AuthTabs active="login" />}
      <form
        onSubmit={submit}
        className="space-y-5 p-6 md:p-8"
      >
        {error && (
          <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
            {error}
          </p>
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
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
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {partnerContext ? "Pas encore partenaire ? " : "Pas encore de compte ? "}
        <Link
          href={partnerContext ? "/partenaire/inscription" : "/inscription"}
          className="font-semibold text-signal hover:underline"
        >
          Créer un compte
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="text-ink-muted hover:text-signal">
          Mot de passe oublié ?
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  type,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  type: string;
  autoComplete: string;
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
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
    </div>
  );
}
