"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi, downloadAdminInvoice, type AdminOrderDetail, type AuditEntry } from "@/lib/admin";
import { STATUS_LABEL } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CopyButton } from "@/components/admin/CopyButton";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";

const TRANSITION_LABEL: Record<string, string> = {
  sent_to_supplier: "Transmise au fournisseur",
  shipped: "Marquer expédiée",
  delivered: "Marquer livrée",
  cancelled: "Annuler",
  refunded: "Rembourser",
};

export default function AdminOrderDetail() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulaire changement de statut
  const [targetStatus, setTargetStatus] = useState("");
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Note admin
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Audit history
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);

  // Confirmation actions destructives
  const [confirmDestructive, setConfirmDestructive] = useState<null | (() => void)>(null);

  async function saveNote() {
    setNoteSaving(true);
    try {
      const updated = await adminApi.updateNote(orderNumber, note);
      setOrder(updated);
      toast("Note enregistrée", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleDownload() {
    setPdfLoading(true);
    try { await downloadAdminInvoice(orderNumber); }
    finally { setPdfLoading(false); }
  }

  useEffect(() => {
    adminApi.getOrder(orderNumber)
      .then((o) => {
        setOrder(o);
        setNote((o as AdminOrderDetail & { admin_note?: string }).admin_note ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"));
    adminApi.listAudit(orderNumber).then(setAuditEntries).catch(() => setAuditEntries([]));
  }, [orderNumber]);

  async function doUpdateStatus() {
    setUpdating(true);
    setUpdateError(null);
    try {
      const updated = await adminApi.updateStatus(orderNumber, {
        status: targetStatus,
        tracking_number: tracking || undefined,
        carrier: carrier || undefined,
        tracking_url: trackingUrl || undefined,
        cancel_reason: cancelReason || undefined,
      });
      setOrder(updated);
      setTargetStatus("");
      setTracking(""); setCarrier(""); setTrackingUrl(""); setCancelReason("");
      toast("Statut mis à jour", "success");
      adminApi.listAudit(orderNumber).then(setAuditEntries).catch(() => {});
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Erreur");
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setUpdating(false);
    }
  }

  function submitStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStatus || !order) return;
    if (targetStatus === "cancelled" || targetStatus === "refunded") {
      // Confirmation pour actions destructives
      setConfirmDestructive(() => doUpdateStatus);
    } else {
      doUpdateStatus();
    }
  }

  if (error) {
    return <p className="rounded-xl bg-signal-light px-4 py-3 text-sm text-signal-dark">{error}</p>;
  }
  if (!order) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }

  const addr = order.shipping_address;

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => router.back()}
        className="mb-6 text-sm font-semibold text-ink-soft hover:text-signal"
      >
        ← Retour
      </button>

      {/* En-tête */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-black text-ink">{order.order_number}</h1>
            <CopyButton value={order.order_number} />
          </div>
          {order.invoice_number && (
            <p className="mt-0.5 text-sm font-semibold text-signal">
              Facture {`FAC-${new Date(order.paid_at!).getFullYear()}-${String(order.invoice_number).padStart(6, "0")}`}
            </p>
          )}
          <p className="mt-1 text-sm text-ink-muted">
            {new Date(order.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "long", year: "numeric",
            })}
            {order.paid_at && (
              <> · Payée le {new Date(order.paid_at).toLocaleDateString("fr-FR", {
                day: "2-digit", month: "long", year: "numeric",
              })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <button
            onClick={handleDownload}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
          >
            {pdfLoading ? "…" : "⬇ Facture PDF"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Client */}
          <Section title="Client">
            <Row label="Nom" value={order.customer_name ?? "—"} />
            <Row label="Email" value={order.customer_email} />
          </Section>

          {/* Adresse */}
          <Section title="Adresse de livraison">
            {addr.label && <Row label="Libellé" value={addr.label} />}
            <Row label="Adresse" value={[addr.line1, addr.line2].filter(Boolean).join(", ")} />
            <Row label="Ville" value={`${addr.postal_code} ${addr.city}`} />
            <Row label="Pays" value={addr.country ?? "FR"} />
          </Section>

          {/* Articles */}
          <Section title="Articles">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="pb-2 text-left">Réf.</th>
                  <th className="pb-2 text-left">Désignation</th>
                  <th className="pb-2 text-center">Qté</th>
                  <th className="pb-2 text-right">PU TTC</th>
                  <th className="pb-2 text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.supplier_ref} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-xs text-ink-muted">
                      {it.supplier_ref}
                    </td>
                    <td className="py-2 pr-4 text-ink">{it.label}</td>
                    <td className="py-2 text-center text-ink-soft">{it.quantity}</td>
                    <td className="py-2 text-right text-ink-soft">
                      {it.unit_price_ttc.toFixed(2).replace(".", ",")} €
                    </td>
                    <td className="py-2 text-right font-semibold text-ink">
                      {it.line_total_ttc.toFixed(2).replace(".", ",")} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 border-t border-line pt-4 text-sm space-y-1">
              <div className="flex justify-between text-ink-soft">
                <span>Articles HT</span>
                <span>{order.articles_ht.toFixed(2).replace(".", ",")} €</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Livraison TTC</span>
                <span>{order.shipping_ttc.toFixed(2).replace(".", ",")} €</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>TVA</span>
                <span>{order.total_vat.toFixed(2).replace(".", ",")} €</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 font-display text-base font-black text-ink">
                <span>Total TTC</span>
                <span>{order.total_ttc.toFixed(2).replace(".", ",")} €</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Colonne latérale — changement de statut */}
        <div className="space-y-4">
          {order.allowed_transitions.length > 0 ? (
            <Section title="Changer le statut">
              <form onSubmit={submitStatus} className="space-y-3">
                <select
                  required
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
                >
                  <option value="">— Sélectionner —</option>
                  {order.allowed_transitions.map((s) => (
                    <option key={s} value={s}>
                      {TRANSITION_LABEL[s] ?? STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>

                {targetStatus === "shipped" && (
                  <>
                    <input
                      type="text"
                      placeholder="Transporteur (ex: Colissimo)"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
                    />
                    <input
                      type="text"
                      placeholder="N° de suivi (optionnel)"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
                    />
                    <input
                      type="url"
                      placeholder="URL de suivi (optionnel)"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
                    />
                  </>
                )}

                {(targetStatus === "cancelled" || targetStatus === "refunded") && (
                  <textarea
                    placeholder="Motif (optionnel)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-signal"
                  />
                )}

                {updateError && (
                  <p className="rounded-lg bg-signal-light px-3 py-2 text-xs text-signal-dark">{updateError}</p>
                )}

                <button
                  type="submit"
                  disabled={!targetStatus || updating}
                  className="w-full rounded-lg bg-signal py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
                >
                  {updating ? "Mise à jour…" : "Confirmer"}
                </button>
              </form>
            </Section>
          ) : (
            <Section title="Statut">
              <p className="text-sm text-ink-muted">
                Commande en état terminal — aucune transition possible.
              </p>
            </Section>
          )}

          {/* Note interne admin */}
          <Section title="Note interne (non visible client)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Ex : client a appelé, retard accepté…"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-signal"
            />
            <button
              onClick={saveNote}
              disabled={noteSaving}
              className="mt-2 rounded-lg bg-ink px-4 py-1.5 text-xs font-bold text-paper hover:bg-signal disabled:opacity-60"
            >
              {noteSaving ? "Enregistrement…" : "Enregistrer la note"}
            </button>
          </Section>

          {/* Historique audit */}
          <Section title="Historique">
            {auditEntries === null ? (
              <p className="text-xs text-ink-muted">Chargement…</p>
            ) : auditEntries.length === 0 ? (
              <p className="text-xs text-ink-muted">Aucune modification enregistrée.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {auditEntries.map((e) => (
                  <li key={e.id} className="border-l-2 border-line pl-3">
                    <p className="font-semibold text-ink">{labelizeAction(e.action)}</p>
                    <p className="text-ink-muted">
                      {e.actor_email ?? "—"} · {new Date(e.created_at).toLocaleString("fr-FR")}
                    </p>
                    {e.payload && Object.keys(e.payload).length > 0 && (
                      <p className="mt-0.5 text-ink-muted">
                        {Object.entries(e.payload)
                          .filter(([, v]) => v !== null && v !== undefined && v !== "")
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDestructive !== null}
        title={targetStatus === "cancelled" ? "Annuler la commande ?" : "Rembourser la commande ?"}
        message={
          targetStatus === "cancelled"
            ? "Cette action déclenche un email d'annulation au client et ne peut pas être annulée."
            : "Cette action déclenche un email au client. Assurez-vous d'avoir traité le remboursement bancaire."
        }
        confirmLabel={targetStatus === "cancelled" ? "Annuler la commande" : "Rembourser"}
        danger
        onClose={() => setConfirmDestructive(null)}
        onConfirm={() => { confirmDestructive?.(); setConfirmDestructive(null); }}
      />
    </div>
  );
}

function labelizeAction(action: string): string {
  return {
    "order.status_change": "Changement de statut",
    "order.note_update": "Note modifiée",
  }[action] ?? action;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5 shadow-card">
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted">{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
