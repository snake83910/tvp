"use client";

import { useState } from "react";
import { accountApi } from "@/lib/auth";

export function SecurityTab({ user }: { user: { email: string } }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPwd, setEmailPwd] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd !== newPwd2) { setPwdMsg({ tone: "err", text: "Les mots de passe ne correspondent pas" }); return; }
    setPwdBusy(true);
    try {
      await accountApi.changePassword(oldPwd, newPwd);
      setPwdMsg({ tone: "ok", text: "Mot de passe modifié avec succès" });
      setOldPwd(""); setNewPwd(""); setNewPwd2("");
    } catch (e) {
      setPwdMsg({ tone: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally { setPwdBusy(false); }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMsg(null); setEmailBusy(true);
    try {
      // Action sensible : le backend exige une re-saisie du mot de passe
      const { reauth_token } = await accountApi.reauth(emailPwd);
      await accountApi.requestEmailChange(newEmail, reauth_token);
      setEmailMsg({ tone: "ok", text: `Email de confirmation envoyé à ${newEmail}` });
      setNewEmail(""); setEmailPwd("");
    } catch (e) {
      setEmailMsg({ tone: "err", text: e instanceof Error ? e.message : "Erreur" });
    } finally { setEmailBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Email */}
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-black text-ink">Adresse email</h2>
        <p className="text-sm text-ink-muted">Actuelle : <strong className="text-ink">{user.email}</strong></p>
        {emailMsg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            emailMsg.tone === "ok" ? "bg-ok/10 text-ok" : "bg-signal-light text-signal-dark"
          }`}>{emailMsg.text}</p>
        )}
        <form onSubmit={changeEmail} className="mt-4 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="nouvelle.adresse@example.com"
              className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={emailPwd}
              onChange={(e) => setEmailPwd(e.target.value)}
              placeholder="Mot de passe actuel"
              className="h-11 flex-1 rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
            />
          </div>
          <button
            type="submit"
            disabled={emailBusy}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            {emailBusy ? "Envoi…" : "Changer mon email"}
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">
          Par sécurité, votre mot de passe actuel est demandé. Un lien de confirmation sera envoyé à la nouvelle adresse — l&apos;email n&apos;est pas changé tant que vous n&apos;avez pas cliqué dessus, et vous serez déconnecté de toutes vos sessions après le changement.
        </p>
      </section>

      {/* Mot de passe */}
      <section className="rounded-2xl border border-line bg-paper p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-black text-ink">Mot de passe</h2>
        <p className="text-sm text-ink-muted">Choisissez un mot de passe robuste, jamais utilisé ailleurs.</p>
        {pwdMsg && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            pwdMsg.tone === "ok" ? "bg-ok/10 text-ok" : "bg-signal-light text-signal-dark"
          }`}>{pwdMsg.text}</p>
        )}
        <form onSubmit={changePwd} className="mt-4 space-y-3">
          <PwdInput label="Mot de passe actuel" value={oldPwd} onChange={setOldPwd} autoComplete="current-password" />
          <PwdInput label="Nouveau mot de passe" value={newPwd} onChange={setNewPwd} autoComplete="new-password" />
          <PwdInput label="Confirmer" value={newPwd2} onChange={setNewPwd2} autoComplete="new-password" />
          <p className="text-xs text-ink-muted">
            Min. 10 caractères, 1 majuscule, 1 chiffre ou caractère spécial.
            Les mots de passe issus de fuites connues sont refusés.
          </p>
          <button
            type="submit"
            disabled={pwdBusy}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-paper hover:bg-signal disabled:opacity-60"
          >
            {pwdBusy ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      </section>
    </div>
  );
}

function PwdInput({
  label, value, onChange, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</label>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-signal"
      />
    </div>
  );
}
