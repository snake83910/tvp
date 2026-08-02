"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { partnerRegister } from "@/lib/partner";

export default function PartnerRegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({
    garage_name: "",
    email: "",
    password: "",
    address: "",
    postal_code: "",
    city: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await partnerRegister({
        email: f.email.trim(),
        password: f.password,
        garage_name: f.garage_name.trim(),
        address: f.address.trim(),
        postal_code: f.postal_code.trim(),
        city: f.city.trim(),
        phone: f.phone.trim() || null,
      });
      router.push("/partenaire");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal">
          Espace partenaire
        </p>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tightest text-ink">
          Devenir garage partenaire
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Créez votre compte pour gérer votre page et recevoir les commandes
          de montage. Votre page sera visible après validation par notre
          équipe.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {error && (
            <p className="rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
              {error}
            </p>
          )}
          <Field label="Nom du garage" value={f.garage_name} onChange={(v) => set("garage_name", v)} required />
          <Field label="Adresse" value={f.address} onChange={(v) => set("address", v)} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal" value={f.postal_code} onChange={(v) => set("postal_code", v)} required />
            <Field label="Ville" value={f.city} onChange={(v) => set("city", v)} required />
          </div>
          <Field label="Téléphone" value={f.phone} onChange={(v) => set("phone", v)} />
          <hr className="border-line" />
          <Field label="Email de connexion" type="email" value={f.email} onChange={(v) => set("email", v)} required autoComplete="email" />
          <PasswordField
            label="Mot de passe (8 caractères min.)"
            value={f.password}
            onChange={(v) => set("password", v)}
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-signal py-3 font-display font-bold uppercase tracking-wide text-white transition hover:bg-signal-dark disabled:opacity-60"
          >
            {busy ? "Création…" : "Créer mon compte partenaire"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Déjà partenaire ?{" "}
          <Link href="/partenaire/login" className="font-semibold text-signal hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-signal"
      />
    </div>
  );
}
