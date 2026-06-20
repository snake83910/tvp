"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/components/admin/Toast";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders() {
  const t = typeof window !== "undefined" ? sessionStorage.getItem("tvp_access") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export default function AdminProfilPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== newPwd2) {
      toast("Les mots de passe ne correspondent pas", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/me/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur");
      }
      toast("Mot de passe modifié", "success");
      setOldPwd(""); setNewPwd(""); setNewPwd2("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail || !newEmail.includes("@")) {
      toast("Email invalide", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/auth/request-email-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ new_email: newEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Erreur");
      }
      toast(`Email de confirmation envoyé à ${newEmail}`, "success");
      setNewEmail("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-black text-ink">Mon profil</h1>

      <div className="mb-6 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Compte</p>
        <p className="mt-2 font-semibold text-ink">{user?.email}</p>
        <p className="mt-0.5 text-xs text-ink-muted">Rôle : {user?.role}</p>
      </div>

      {/* Changer email */}
      <div className="mb-6 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Changer mon email
        </p>
        <form onSubmit={submitEmail} className="flex gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nouvelle.adresse@example.com"
            className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-ink px-4 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            Envoyer le lien
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Un lien de confirmation sera envoyé à la nouvelle adresse. L'email
          n'est changé qu'après confirmation.
        </p>
      </div>

      {/* Changer mot de passe */}
      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Changer mon mot de passe
        </p>
        <form onSubmit={submitPwd} className="space-y-4">
          <PasswordField label="Mot de passe actuel" value={oldPwd} onChange={setOldPwd} autocomplete="current-password" />
          <PasswordField label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} autocomplete="new-password" />
          <PasswordField label="Confirmer" value={newPwd2} onChange={setNewPwd2} autocomplete="new-password" />
          <p className="text-xs text-ink-muted">
            Min. 10 caractères, 1 majuscule, 1 chiffre ou caractère spécial.
            Les mots de passe issus de fuites connues sont refusés.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            {busy ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, autocomplete,
}: { label: string; value: string; onChange: (v: string) => void; autocomplete: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</label>
      <input
        type="password"
        required
        autoComplete={autocomplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
      />
    </div>
  );
}
