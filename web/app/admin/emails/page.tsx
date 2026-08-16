"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  previewEmailTemplate,
  type EmailTemplateDetail,
  type EmailTemplateSummary,
} from "@/lib/admin";
import { useToast } from "@/components/admin/Toast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

/** Nom de fichier → intitulé lisible. Un template s'édite pour changer
 *  ce que lit un client : la liste doit parler de l'email, pas du
 *  fichier. Les noms non listés retombent sur le fichier. */
const LABELS: Record<string, string> = {
  "_layout.html": "Squelette commun (en-tête et pied de page)",
  "admin_new_garage.html": "Interne — nouveau garage à valider",
  "appointment_at_risk.html": "RDV — pneus pas encore expédiés",
  "appointment_changed_garage.html": "RDV — avis au garage d'un changement",
  "appointment_confirmed.html": "RDV — confirmation du créneau",
  "appointment_reminder.html": "RDV — rappel la veille",
  "bulk_admin.html": "Interne — envoi groupé",
  "email_change_confirm.html": "Compte — confirmer la nouvelle adresse",
  "email_change_notice.html": "Compte — alerte sur l'ancienne adresse",
  "garage_new_order.html": "Garage — nouvelle commande à monter",
  "login_alert.html": "Sécurité — connexion administrateur",
  "order_cancelled.html": "Commande annulée",
  "order_confirmation.html": "Commande confirmée",
  "order_delivered.html": "Commande livrée",
  "order_dunning.html": "Commande — relance de paiement",
  "order_refunded.html": "Commande remboursée",
  "order_shipped.html": "Commande expédiée",
  "password_reset.html": "Compte — réinitialisation du mot de passe",
  "review_request.html": "Demande d'avis sur le garage",
  "verify_email.html": "Compte — vérification de l'adresse",
  "welcome.html": "Compte — bienvenue",
};

export default function AdminEmails() {
  const { toast } = useToast();
  const [list, setList] = useState<EmailTemplateSummary[] | null>(null);
  const [current, setCurrent] = useState<EmailTemplateDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const refreshList = useCallback(
    () => adminApi.listEmailTemplates().then(setList),
    [],
  );

  useEffect(() => {
    refreshList().catch((e) =>
      toast(e instanceof Error ? e.message : "Erreur", "error"),
    );
  }, [refreshList, toast]);

  async function open(name: string) {
    try {
      const detail = await adminApi.getEmailTemplate(name);
      setCurrent(detail);
      setDraft(detail.html);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  // Aperçu redemandé au serveur : c'est le même moteur bridé que
  // l'envoi réel, donc ce qu'on voit est ce que le client recevra. Le
  // faire côté navigateur donnerait une approximation.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(async () => {
      try {
        setPreview(await previewEmailTemplate(current.name, draft));
        setPreviewError(null);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : "Erreur de rendu");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [current, draft]);

  async function save() {
    if (!current) return;
    setBusy(true);
    try {
      await adminApi.saveEmailTemplate(current.name, draft);
      toast("Template enregistré", "success");
      await refreshList();
      setCurrent({ ...current, modified: true, html: draft });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!current) return;
    setBusy(true);
    try {
      await adminApi.resetEmailTemplate(current.name);
      const detail = await adminApi.getEmailTemplate(current.name);
      setCurrent(detail);
      setDraft(detail.html);
      toast("Template d'origine restauré", "success");
      await refreshList();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  const dirty = current !== null && draft !== current.html;

  return (
    <div>
      <h1 className="font-display text-3xl font-black text-ink">Emails</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Les textes envoyés aux clients. Le fichier livré avec le site sert
        de version d&apos;origine : on peut y revenir à tout moment.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Liste */}
        <div className="rounded-2xl border border-line bg-paper p-3 shadow-card">
          {!list ? (
            <p className="p-3 text-sm text-ink-muted">Chargement…</p>
          ) : (
            <ul className="space-y-0.5">
              {list.map((t) => (
                <li key={t.name}>
                  <button
                    onClick={() => open(t.name)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      current?.name === t.name
                        ? "bg-ink text-paper"
                        : "text-ink-soft hover:bg-paper-dim"
                    }`}
                  >
                    <span className="block truncate">
                      {LABELS[t.name] ?? t.name}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        current?.name === t.name
                          ? "text-paper/60"
                          : "text-ink-muted"
                      }`}
                    >
                      {t.locked
                        ? "verrouillé"
                        : t.modified
                          ? "modifié"
                          : "d'origine"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Éditeur + aperçu */}
        {!current ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-sm text-ink-muted shadow-card">
            Choisissez un email dans la liste.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-black text-ink">
                  {LABELS[current.name] ?? current.name}
                </h2>
                <p className="font-mono text-xs text-ink-muted">
                  {current.name}
                </p>
              </div>
              <div className="flex gap-2">
                {current.modified && (
                  <button
                    onClick={() => setConfirmReset(true)}
                    disabled={busy}
                    className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
                  >
                    Revenir à l&apos;origine
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={busy || current.locked || !dirty}
                  className="rounded-lg bg-signal px-5 py-2 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
                >
                  {busy ? "…" : "Enregistrer"}
                </button>
              </div>
            </div>

            {current.locked && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Ce squelette porte l&apos;en-tête et le pied de page de{" "}
                <strong>tous</strong> les emails. Le modifier ici les
                casserait d&apos;un coup : il est consultable, pas éditable.
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <label
                  htmlFor="tpl-source"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-muted"
                >
                  Source {dirty && <span className="text-signal">— modifiée</span>}
                </label>
                <textarea
                  id="tpl-source"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  readOnly={current.locked}
                  spellCheck={false}
                  rows={24}
                  className="w-full rounded-lg border border-line bg-paper p-3 font-mono text-xs leading-relaxed text-ink outline-none focus:border-signal read-only:bg-paper-dim"
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Les valeurs entre <code>{"{{ }}"}</code> sont remplacées à
                  l&apos;envoi. L&apos;aperçu utilise des données
                  d&apos;exemple ; une variable inconnue s&apos;y affiche
                  entre chevrons.
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Aperçu
                </p>
                {previewError ? (
                  <p className="rounded-lg border border-signal/40 bg-signal-light px-4 py-3 text-xs text-signal-dark">
                    {previewError}
                  </p>
                ) : (
                  /* iframe CLOISONNÉE : le HTML rendu est du contenu
                     éditable, et cette page porte une session admin.
                     Sans sandbox, un script collé dans un template
                     s'exécuterait avec les droits de l'administrateur. */
                  <iframe
                    title="Aperçu de l'email"
                    srcDoc={preview}
                    sandbox=""
                    className="h-[560px] w-full rounded-lg border border-line bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Revenir au texte d'origine ?"
        message="Votre version personnalisée sera supprimée et le fichier livré avec le site reprendra sa place."
        confirmLabel="Restaurer l'origine"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          reset();
        }}
      />
    </div>
  );
}
