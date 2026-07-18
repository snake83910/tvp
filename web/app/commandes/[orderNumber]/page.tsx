"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  accountApi,
  downloadInvoice,
  useCurrentUser,
  type OrderDetail,
} from "@/lib/auth";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "En attente de paiement",
  paid: "Payée",
  sent_to_supplier: "En cours de préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "bg-paper-dim text-ink-soft",
  paid: "bg-ok/10 text-ok",
  sent_to_supplier: "bg-ok/10 text-ok",
  shipped: "bg-ok/10 text-ok",
  delivered: "bg-ok/10 text-ok",
  cancelled: "bg-signal-light text-signal-dark",
  refunded: "bg-signal-light text-signal-dark",
};

export default function OrderDetailPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    if (
      !confirm(
        "Annuler cette commande ? Cette action est définitive — vous pourrez repasser commande à tout moment.",
      )
    )
      return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await accountApi.cancelOrder(params.orderNumber);
      const updated = await accountApi.getOrder(params.orderNumber);
      setOrder(updated);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleDownload() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadInvoice(params.orderNumber);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    accountApi
      .getOrder(params.orderNumber)
      .then(setOrder)
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Commande introuvable",
        ),
      );
  }, [user, params.orderNumber]);

  if (loading || !user) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <Link
            href="/compte"
            className="text-sm text-ink-muted hover:text-signal"
          >
            ← Retour à mes commandes
          </Link>
          <div className="mt-6 rounded-2xl border border-signal/40 bg-signal-light p-6">
            <p className="font-semibold text-signal-dark">{error}</p>
          </div>
        </main>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  const addr = order.shipping_address;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-signal"
        >
          ← Retour à mes commandes
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
              Commande {order.order_number}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Passée le{" "}
              {new Date(order.created_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
              {order.paid_at && (
                <>
                  {" "}
                  · Payée le{" "}
                  {new Date(order.paid_at).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1.5 text-sm font-bold ${
                STATUS_COLOR[order.status] ?? "bg-paper-dim text-ink-soft"
              }`}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
            <button
              onClick={handleDownload}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
            >
              {pdfLoading ? "…" : "⬇ Facture PDF"}
            </button>
          </div>
          {pdfError && (
            <p className="text-xs text-signal">{pdfError}</p>
          )}
        </div>

        {/* Commande en attente : proposer de payer maintenant ou d'annuler,
            plutôt que de la laisser bloquée jusqu'à l'annulation auto J+7 */}
        {order.status === "pending_payment" && (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">
              Cette commande attend son paiement.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Vous pouvez la régler maintenant, ou l&apos;annuler si vous
              avez changé d&apos;avis. Sans paiement, elle sera annulée
              automatiquement sous 7 jours.
            </p>
            {cancelError && (
              <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-xs text-signal-dark">
                {cancelError}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/paiement/${order.order_number}`}
                className="rounded-full bg-signal px-5 py-2.5 text-sm font-bold text-white transition hover:bg-signal-dark"
              >
                Payer maintenant — {order.total_ttc.toFixed(2).replace(".", ",")} €
              </Link>
              <button
                onClick={handleCancel}
                disabled={cancelBusy}
                className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal disabled:opacity-50"
              >
                {cancelBusy ? "Annulation…" : "Annuler la commande"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Articles */}
          <section className="rounded-2xl border border-line bg-paper shadow-card">
            <h2 className="border-b border-line px-6 py-4 font-display font-bold text-ink">
              Articles
            </h2>
            <div className="divide-y divide-line">
              {order.items.map((it) => (
                <div
                  key={it.supplier_ref}
                  className="flex items-start justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">
                      {it.label}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Réf {it.supplier_ref} · {it.quantity} pneu
                      {it.quantity > 1 ? "s" : ""} ×{" "}
                      {it.unit_price_ttc.toFixed(2).replace(".", ",")}{" "}
                      €
                    </p>
                  </div>
                  <p className="shrink-0 font-display font-black text-ink">
                    {it.line_total_ttc.toFixed(2).replace(".", ",")} €
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Colonne récap */}
          <aside className="space-y-6">
            {/* Adresse livraison */}
            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Livraison
              </p>
              <p className="text-sm font-semibold text-ink">
                {addr.label ?? "Adresse de livraison"}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {addr.line1}
                {addr.line2 ? (
                  <>
                    <br />
                    {addr.line2}
                  </>
                ) : null}
                <br />
                {addr.postal_code} {addr.city}
                <br />
                {addr.country}
              </p>
              <p className="mt-3 text-xs text-ink-muted">
                Mode :{" "}
                {order.delivery_mode === "home"
                  ? "domicile"
                  : order.delivery_mode}
              </p>
            </div>

            {/* Suivi expédition */}
            {(order.status === "shipped" || order.status === "delivered") && (
              <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                  Suivi de colis
                </p>
                {order.carrier && (
                  <p className="text-sm text-ink-soft">
                    Transporteur :{" "}
                    <span className="font-semibold text-ink">{order.carrier}</span>
                  </p>
                )}
                {order.tracking_number && (
                  <p className="mt-1 text-sm text-ink-soft">
                    N° de suivi :{" "}
                    <span className="font-mono font-semibold text-ink">
                      {order.tracking_number}
                    </span>
                  </p>
                )}
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-signal px-4 py-2 text-sm font-bold text-white transition hover:bg-signal-dark"
                  >
                    Suivre mon colis →
                  </a>
                )}
                {!order.tracking_number && !order.tracking_url && (
                  <p className="text-sm text-ink-muted">
                    Informations de suivi bientôt disponibles.
                  </p>
                )}
              </div>
            )}

            {/* Récap montants */}
            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Récapitulatif
              </p>
              <Row k="Articles" v={order.articles_ttc} />
              <Row
                k="Livraison"
                v={order.shipping_ttc}
                free={order.shipping_ttc === 0}
              />
              <div className="mt-2 flex justify-between border-t border-line pt-3 text-xs text-ink-muted">
                <span>dont TVA</span>
                <span>
                  {order.total_vat.toFixed(2).replace(".", ",")} €
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-xl font-black text-ink">
                <span>Total TTC</span>
                <span>
                  {order.total_ttc.toFixed(2).replace(".", ",")} €
                </span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Row({
  k,
  v,
  free,
}: {
  k: string;
  v: number;
  free?: boolean;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ink-soft">{k}</span>
      <span className="font-semibold text-ink">
        {free ? "Offerte" : `${v.toFixed(2).replace(".", ",")} €`}
      </span>
    </div>
  );
}
