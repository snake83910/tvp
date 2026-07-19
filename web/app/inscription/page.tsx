"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthTabs } from "@/components/AuthTabs";
import {
  PasswordField,
  passwordMeetsRules,
} from "@/components/PasswordField";
import { accountApi, auth } from "@/lib/auth";

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="mx-auto max-w-xl px-6 py-16">
            <p className="text-ink-muted">Chargement…</p>
          </main>
        }
      >
        <RegisterContent />
      </Suspense>
    </>
  );
}

function RegisterContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/compte";

  const [accountType, setAccountType] = useState<"particulier" | "pro">(
    "particulier",
  );
  const [form, setForm] = useState({
    email: "",
    password: "",
    password2: "",
    first_name: "",
    last_name: "",
    phone: "",
    company_name: "",
    siret: "",
    vat_number: "",
    line1: "",
    line2: "",
    postal_code: "",
    city: "",
    country: "FR",
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
        "Le mot de passe ne respecte pas encore toutes les règles indiquées.",
      );
      return;
    }
    if (form.password !== form.password2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (accountType === "pro" && form.company_name.trim().length < 2) {
      setError("La raison sociale est requise pour un compte professionnel.");
      return;
    }

    setBusy(true);
    try {
      await auth.register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        account_type: accountType,
        pro:
          accountType === "pro"
            ? {
                company_name: form.company_name.trim(),
                siret: form.siret.trim() || null,
                vat_number: form.vat_number.trim() || null,
              }
            : undefined,
      });
      await auth.login(form.email, form.password);

      // Adresse de facturation par défaut : pré-remplit le checkout.
      // Best effort : un échec ici ne doit pas bloquer l'inscription.
      try {
        await accountApi.addAddress({
          label: "Facturation",
          line1: form.line1,
          line2: form.line2 || null,
          postal_code: form.postal_code,
          city: form.city,
          country: form.country,
          is_default: true,
        });
      } catch {
        /* l'utilisateur pourra la saisir au checkout */
      }

      router.push(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Inscription impossible",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="mb-2 text-right text-xs text-signal">
        * Champs obligatoires
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        <AuthTabs active="register" />

        <form onSubmit={submit} className="space-y-8 p-6 md:p-8">
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
              {error}
            </p>
          )}

          {/* Type de compte */}
          <section>
            <SectionTitle>Vous êtes un</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                active={accountType === "particulier"}
                title="Particulier"
                subtitle="Prix TTC"
                onClick={() => setAccountType("particulier")}
              />
              <TypeCard
                active={accountType === "pro"}
                title="Professionnel"
                subtitle="Prix HT, tarifs pro"
                onClick={() => setAccountType("pro")}
              />
            </div>
          </section>

          {/* Identifiants */}
          <section>
            <SectionTitle>Identifiants</SectionTitle>
            <div className="space-y-4">
              <Field
                label="Adresse email *"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(v) => up("email", v)}
              />
              <PasswordField
                label="Mot de passe *"
                value={form.password}
                onChange={(v) => up("password", v)}
                autoComplete="new-password"
                showChecklist
              />
              <PasswordField
                label="Confirmation du mot de passe *"
                value={form.password2}
                onChange={(v) => up("password2", v)}
                autoComplete="new-password"
              />
              {form.password2.length > 0 && (
                <p
                  className={`-mt-2 text-xs ${
                    form.password === form.password2
                      ? "text-ok"
                      : "text-ink-muted"
                  }`}
                >
                  {form.password === form.password2
                    ? "✓ Les mots de passe correspondent"
                    : "○ Les mots de passe ne correspondent pas encore"}
                </p>
              )}
            </div>
          </section>

          {/* Société (pro uniquement) */}
          {accountType === "pro" && (
            <section>
              <SectionTitle>Votre société</SectionTitle>
              <div className="space-y-4">
                <Field
                  label="Raison sociale *"
                  value={form.company_name}
                  onChange={(v) => up("company_name", v)}
                  placeholder="Garage Dupont SARL"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="SIRET"
                    value={form.siret}
                    onChange={(v) => up("siret", v)}
                    placeholder="732 829 320 00074"
                    hint="14 chiffres — vérifié automatiquement"
                    required={false}
                  />
                  <Field
                    label="N° TVA intracommunautaire"
                    value={form.vat_number}
                    onChange={(v) => up("vat_number", v)}
                    placeholder="FR12345678901"
                    required={false}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Coordonnées */}
          <section>
            <SectionTitle>Vos coordonnées</SectionTitle>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Prénom *"
                  autoComplete="given-name"
                  value={form.first_name}
                  onChange={(v) => up("first_name", v)}
                />
                <Field
                  label="Nom *"
                  autoComplete="family-name"
                  value={form.last_name}
                  onChange={(v) => up("last_name", v)}
                />
              </div>
              <Field
                label="Téléphone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(v) => up("phone", v)}
                placeholder="06 12 34 56 78"
                hint="Utilisé uniquement pour le suivi de vos livraisons"
                required={false}
              />
            </div>
          </section>

          {/* Adresse de facturation */}
          <section>
            <SectionTitle>Adresse de facturation</SectionTitle>
            <div className="space-y-4">
              <Field
                label="Adresse *"
                autoComplete="address-line1"
                value={form.line1}
                onChange={(v) => up("line1", v)}
                placeholder="12 rue de la Paix"
              />
              <Field
                label="Complément d'adresse"
                autoComplete="address-line2"
                value={form.line2}
                onChange={(v) => up("line2", v)}
                placeholder="Bâtiment, étage…"
                required={false}
              />
              <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                <Field
                  label="Code postal *"
                  autoComplete="postal-code"
                  value={form.postal_code}
                  onChange={(v) => up("postal_code", v)}
                  placeholder="75001"
                />
                <Field
                  label="Ville *"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(v) => up("city", v)}
                  placeholder="Paris"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Pays *
                </label>
                <select
                  value={form.country}
                  onChange={(e) => up("country", e.target.value)}
                  className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
                >
                  <option value="FR">France</option>
                  <option value="BE">Belgique</option>
                  <option value="CH">Suisse</option>
                  <option value="LU">Luxembourg</option>
                </select>
              </div>
            </div>
          </section>

          <div className="space-y-3">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-signal py-3.5 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
            >
              {busy ? "Création du compte…" : "Créer mon compte"}
            </button>
            <p className="text-center text-xs text-ink-muted">
              En créant votre compte, vous acceptez nos{" "}
              <Link href="/cgv" className="text-signal hover:underline">
                conditions générales de vente
              </Link>{" "}
              et notre{" "}
              <Link
                href="/confidentialite"
                className="text-signal hover:underline"
              >
                politique de confidentialité
              </Link>
              .
            </p>
          </div>
        </form>
      </div>

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
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-black uppercase tracking-[0.15em] text-ink">
      {children}
    </h2>
  );
}

function TypeCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border-2 p-4 text-left transition ${
        active
          ? "border-signal bg-signal/5"
          : "border-line hover:border-signal/40"
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
            active ? "border-signal" : "border-line-strong"
          }`}
        >
          {active && <span className="h-2 w-2 rounded-full bg-signal" />}
        </span>
        <span className={`font-display font-bold ${active ? "text-signal" : "text-ink"}`}>
          {title}
        </span>
      </span>
      <span className="mt-1 block pl-6 text-xs text-ink-muted">{subtitle}</span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  hint,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
      />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
