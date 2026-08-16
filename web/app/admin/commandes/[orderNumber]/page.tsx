"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  adminApi,
  downloadAdminCreditNote,
  downloadAdminInvoice,
  type AdminOrderDetail,
  type AuditEntry,
} from "@/lib/admin";
import { STATUS_LABEL } from "@/lib/orderStatus";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CopyButton } from "@/components/admin/CopyButton";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import {
  AddressBlock,
  DenseRow,
  OrderDates,
  OrderItems,
  OrderTotals,
  TrackingBlock,
  creditNoteLabel,
  invoiceLabel,
} from "@/components/order/blocks";

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
  // Montant remboursé, saisi en euros. Le site ne rembourse pas par API :
  // l'opération se fait au back office de la banque, et ce champ est ce
  // qui rend la déclaration vérifiable plus tard.
  const [refundAmount, setRefundAmount] = useState("");
  // Par défaut le site appelle la banque. Coché = l'admin déclare un
  // remboursement DÉJÀ fait à la main : les deux n'ont pas la même
  // valeur probante, le choix doit être conscient.
  const [refundManual, setRefundManual] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [creditNoteLoading, setCreditNoteLoading] = useState(false);

  // Note admin
  const [note, setNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Audit history
  const [auditEntries, setAuditEntries] = useState<AuditEntry[] | null>(null);

  // Confirmation actions destructives
  const [confirmDestructive, setConfirmDestructive] = useState<null | (() => void)>(null);

  // Onglets sidebar droite
  const [tab, setTab] = useState<"status" | "note" | "history">("status");

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

  async function handleCreditNote() {
    const ref = order && creditNoteLabel(order);
    if (!ref) return;
    setCreditNoteLoading(true);
    try {
      await downloadAdminCreditNote(orderNumber, ref);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setCreditNoteLoading(false);
    }
  }

  async function handleDownload() {
    setPdfLoading(true);
    try {
      await downloadAdminInvoice(orderNumber);
    } catch (e) {
      // Sans ce catch, un échec était silencieux : le bouton revenait à
      // son état normal et rien ne se passait, sans la moindre indication.
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setPdfLoading(false);
    }
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
        refund_cents:
          targetStatus === "refunded" ? euroToCents(refundAmount) : undefined,
        refund_manual: targetStatus === "refunded" ? refundManual : undefined,
      });
      setOrder(updated);
      setTargetStatus("");
      setTracking(""); setCarrier(""); setTrackingUrl(""); setCancelReason("");
      setRefundAmount(""); setRefundManual(false);
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
    if (targetStatus === "refunded") {
      // Arrêté côté client AUSSI, pour dire quoi corriger avant l'appel
      // plutôt que d'afficher un 422 dans une modale de confirmation.
      const cents = euroToCents(refundAmount);
      const max = Math.round(order.total_ttc * 100);
      if (cents === undefined || cents <= 0 || cents > max) {
        setUpdateError(
          `Saisissez le montant remboursé, entre 0,01 € et ${order.total_ttc.toFixed(2)} €.`,
        );
        return;
      }
      setUpdateError(null);
    }
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
  // Facturation dissociée : bloc affiché uniquement si elle diffère
  const billing = order.billing_address;
  const billingDiffers =
    !!billing &&
    JSON.stringify(billing) !== JSON.stringify(order.shipping_address);

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
          {invoiceLabel(order) && (
            <p className="mt-0.5 text-sm font-semibold text-signal">
              Facture {invoiceLabel(order)}
            </p>
          )}
          <OrderDates order={order} />
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

      {/* Remboursement déclaré : le statut seul ne dit ni combien ni
          quand, et c'est précisément ce qu'on doit pouvoir retrouver six
          mois plus tard face à un client qui conteste. */}
      {order.refunded != null && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            {order.refunded.toFixed(2)} € remboursés
            {order.refunded < order.total_ttc && " (partiel)"}
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            {order.refund_mode === "sogecommerce"
              ? "Exécuté par Sogecommerce"
              : "Déclaré à la main — aucune preuve bancaire attachée"}{" "}
            le{" "}
            {order.refunded_at
              ? new Date(order.refunded_at).toLocaleString("fr-FR")
              : "—"}
          </p>
          {creditNoteLabel(order) && (
            <button
              onClick={handleCreditNote}
              disabled={creditNoteLoading}
              className="mt-3 rounded-full border border-amber-400 px-4 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
            >
              {creditNoteLoading ? "…" : `⬇ Avoir ${creditNoteLabel(order)}`}
            </button>
          )}
        </div>
      )}

      {/* Paiement incertain : la relance a refusé d'annuler cette
          commande faute de réponse de la banque. Sans cette mention,
          elle resterait en attente sans explication. */}
      {order.status === "pending_payment" &&
        order.payment_check_result &&
        !["not_paid", "skipped"].includes(order.payment_check_result) && (
          <div className="mb-6 rounded-xl border border-signal bg-signal-light p-4">
            <p className="text-sm font-bold text-signal-dark">
              {order.payment_check_result === "amount_mismatch"
                ? "La banque a encaissé un montant différent du total"
                : "Paiement non vérifiable auprès de la banque"}
            </p>
            <p className="mt-0.5 text-xs text-signal-dark">
              Cette commande ne sera PAS annulée automatiquement : le
              client a peut-être payé. Vérifiez au back office
              Sogecommerce avant de trancher. Dernier contrôle :{" "}
              {order.payment_checked_at
                ? new Date(order.payment_checked_at).toLocaleString("fr-FR")
                : "—"}
            </p>
          </div>
        )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Client */}
          <Section title="Client">
            <DenseRow label="Nom" value={order.customer_name ?? "—"} />
            <DenseRow label="Email" value={order.customer_email} />
          </Section>

          {/* Adresse */}
          <Section title="Adresse de livraison">
            <AddressBlock address={addr} fallbackLabel="Adresse de livraison" dense />
          </Section>

          {billingDiffers && (
            <Section title="Adresse de facturation">
              <AddressBlock address={billing} fallbackLabel="Adresse de facturation" dense />
            </Section>
          )}

          {/* Articles */}
          <Section title="Articles">
            <OrderItems items={order.items} dense />
            <div className="mt-4 border-t border-line pt-4">
              {/* Le récapitulatif admin omettait la remise promo : sur une
                  commande remisée, articles + livraison + TVA ne tombaient
                  pas sur le total affiché. */}
              <OrderTotals order={order} dense />
            </div>
          </Section>

          {/* Suivi : l'admin saisissait transporteur et numéro dans le
              formulaire de statut sans jamais les revoir ensuite. */}
          {(order.status === "shipped" || order.status === "delivered") && (
            <Section title="Suivi du colis">
              <TrackingBlock order={order} />
            </Section>
          )}
        </div>

        {/* Colonne latérale — onglets Statut / Note / Historique */}
        <div className="space-y-4">
          <div className="flex rounded-lg border border-line bg-paper p-1 text-sm">
            {[
              { k: "status", label: "Statut" },
              { k: "note", label: "Note" },
              { k: "history", label: `Audit${auditEntries ? ` (${auditEntries.length})` : ""}` },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as "status" | "note" | "history")}
                className={`flex-1 rounded px-2 py-1.5 font-semibold transition ${
                  tab === t.k ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-dim"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "status" && (order.allowed_transitions.length > 0 ? (
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

                {targetStatus === "refunded" && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    {order.refund_api_available && !refundManual ? (
                      <>
                        <p className="text-xs font-semibold text-amber-900">
                          Le site va rembourser via Sogecommerce.
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          L&apos;argent part réellement. Si la transaction
                          n&apos;est pas encore remise en banque, elle sera
                          simplement annulée et le client ne sera pas
                          débité. La référence bancaire est archivée sur la
                          commande.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-amber-900">
                          {order.refund_api_available
                            ? "Déclaration d'un remboursement déjà effectué."
                            : "Remboursement automatique indisponible — option Sogecommerce non activée."}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          Rien ne part d&apos;ici : effectuez
                          l&apos;opération au back office Sogecommerce, puis
                          saisissez le montant réellement rendu. Il sera
                          enregistré <strong>sans preuve bancaire</strong>.
                        </p>
                      </>
                    )}
                    <label
                      htmlFor="refund-amount"
                      className="mt-3 mb-1 block text-xs font-bold uppercase tracking-wider text-amber-900"
                    >
                      Montant remboursé (€)
                    </label>
                    <input
                      id="refund-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={order.total_ttc}
                      required
                      placeholder={order.total_ttc.toFixed(2)}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="h-10 w-full rounded-lg border border-amber-300 bg-paper px-3 text-sm text-ink outline-none focus:border-signal"
                    />
                    <p className="mt-1 text-xs text-amber-800">
                      Total de la commande : {order.total_ttc.toFixed(2)} €
                    </p>
                    {order.refund_api_available && (
                      <label className="mt-3 flex items-start gap-2 text-xs text-amber-800">
                        <input
                          type="checkbox"
                          checked={refundManual}
                          onChange={(e) => setRefundManual(e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          J&apos;ai déjà remboursé au back office — enregistrer
                          sans appeler la banque
                        </span>
                      </label>
                    )}
                  </div>
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
          ))}

          {tab === "note" && (
            <Section title="Note interne (non visible client)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={6}
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
          )}

          {tab === "history" && (
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
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDestructive !== null}
        title={targetStatus === "cancelled" ? "Annuler la commande ?" : "Rembourser la commande ?"}
        message={
          targetStatus === "cancelled"
            ? "Cette action déclenche un email d'annulation au client et ne peut pas être annulée."
            : order?.refund_api_available && !refundManual
              ? `${refundAmount || "0"} € vont être RÉELLEMENT rendus au client ` +
                `via Sogecommerce. L'opération n'est pas réversible depuis ce site, ` +
                `et le client en est informé par email.`
              : `Enregistrement d'un remboursement de ${refundAmount || "0"} € ` +
                `effectué au back office. Le client recevra un email : ne validez ` +
                `que si l'argent est réellement parti.`
        }
        confirmLabel={
          targetStatus === "cancelled"
            ? "Annuler la commande"
            : order?.refund_api_available && !refundManual
              ? `Rembourser ${refundAmount || "0"} €`
              : `Déclarer ${refundAmount || "0"} € remboursés`
        }
        danger
        onClose={() => setConfirmDestructive(null)}
        onConfirm={() => { confirmDestructive?.(); setConfirmDestructive(null); }}
      />
    </div>
  );
}

/** Euros saisis → centimes. `undefined` si la saisie n'est pas un
 *  nombre : de l'argent ne se devine pas, mieux vaut refuser que
 *  d'envoyer un NaN au serveur. L'arrondi évite les 4999,999… du
 *  flottant. */
function euroToCents(value: string): number | undefined {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
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
