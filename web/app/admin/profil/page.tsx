"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/auth";
import { useToast } from "@/components/admin/Toast";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminProfilPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitPwd(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) {
      toast("Mot de passe : 8 caractères minimum", "error");
      return;
    }
    if (newPwd !== newPwd2) {
      toast("Les mots de passe ne correspondent pas", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${BROWSER_API}/me/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("tvp_access") ?? ""}`,
        },
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

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-black text-ink">Mon profil</h1>

      <div className="mb-6 rounded-2xl border border-line bg-paper p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Compte</p>
        <p className="mt-2 font-semibold text-ink">{user?.email}</p>
        <p className="mt-0.5 text-xs text-ink-muted">Rôle : {user?.role}</p>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">
          Changer mon mot de passe
        </p>
        <form onSubmit={submitPwd} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Mot de passe actuel
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              className="h-12 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="h-12 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
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
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              className="h-12 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
            />
          </div>
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
