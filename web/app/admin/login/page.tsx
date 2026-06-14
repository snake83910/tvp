"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveTokens } from "@/lib/auth";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AdminLoginResponse {
  requires_2fa: boolean;
  pre_2fa_token?: string;
  access_token?: string;
  refresh_token?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"creds" | "2fa">("creds");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pre2fa, setPre2fa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Connexion impossible");
      }
      const data: AdminLoginResponse = await res.json();
      if (data.requires_2fa && data.pre_2fa_token) {
        setPre2fa(data.pre_2fa_token);
        setStep("2fa");
      } else if (data.access_token && data.refresh_token) {
        saveTokens(data.access_token, data.refresh_token);
        router.push("/admin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/auth/admin/verify-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_2fa_token: pre2fa, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Code incorrect");
      }
      const tokens = await res.json();
      saveTokens(tokens.access_token, tokens.refresh_token);
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-dim px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-8 shadow-card">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-signal">
          Espace réservé
        </p>
        <h1 className="font-display text-2xl font-black tracking-tightest text-ink">
          Connexion administrateur
        </h1>
        <p className="mt-1 text-xs text-ink-muted">
          {step === "creds" ? "Saisissez vos identifiants" : "Code de votre app d'authentification"}
        </p>

        {error && (
          <p className="mt-5 rounded-lg bg-signal-light px-4 py-3 text-sm font-medium text-signal-dark">
            {error}
          </p>
        )}

        {step === "creds" && (
          <form onSubmit={submitCreds} className="mt-6 space-y-4">
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
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                Mot de passe
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-lg border border-line bg-paper px-3 text-ink outline-none transition focus:border-signal"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-ink py-3 font-display font-bold uppercase tracking-wide text-paper transition hover:bg-signal disabled:opacity-60"
            >
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}

        {step === "2fa" && (
          <form onSubmit={submit2fa} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
                Code à 6 chiffres
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="h-14 w-full rounded-lg border border-line bg-paper px-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition focus:border-signal"
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-ink py-3 font-display font-bold uppercase tracking-wide text-paper transition hover:bg-signal disabled:opacity-60"
            >
              {busy ? "Vérification…" : "Valider"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("creds"); setCode(""); setPre2fa(null); }}
              className="block w-full text-center text-xs text-ink-muted hover:text-signal"
            >
              ← Recommencer
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
