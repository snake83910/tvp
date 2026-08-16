"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, use } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";
import { AppointmentCard } from "@/components/checkout/AppointmentCard";
import { formatEuro } from "@/lib/money";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/orderStatus";
import {
  AddressBlock,
  OrderDates,
  OrderItems,
  OrderTotals,
  TrackingBlock,
  invoiceLabel,
} from "@/components/order/blocks";
import {
  accountApi,
  downloadInvoice,
  useCurrentUser,
  type OrderDetail,
} from "@/lib/auth";

/** Statuts pour lesquels le paiement est effectivement encaissé. */
const PAID_STATUSES = new Set([
  "paid",
  "sent_to_supplier",
  "shipped",
  "delivered",
]);

export default function OrderDetailPage(
  props: {
    params: Promise<{ orderNumber: string }>;
  }
) {
  const params = use(props.params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useCurrentUser();
  const { refresh } = useCart();
  // Arrivée depuis le tunnel de paiement.
  const fromPayment = searchParams.get("paiement") === "ok";
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

  // Le panier a été consommé côté serveur : on remet le compteur à jour.
  useEffect(() => {
    if (fromPayment) refresh();
  }, [fromPayment, refresh]);

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
  // Facturation dissociée : bloc affiché uniquement si elle diffère
  const billing = order.billing_address;
  const billingDiffers =
    !!billing &&
    JSON.stringify(billing) !== JSON.stringify(order.shipping_address);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Confirmation de paiement.
            Adossée au STATUT réel, pas au seul paramètre d'URL : la page
            de confirmation précédente annonçait « enregistrée et payée »
            y compris quand le paiement venait d'être REFUSÉ ou la
            commande annulée — le tunnel y renvoyait dans les deux cas. */}
        {fromPayment && PAID_STATUSES.has(order.status) && (
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-ok/40 bg-ok/5 p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ok/15">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-ok" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <p className="font-display text-lg font-black text-ink">
                Merci pour votre commande !
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Votre paiement est confirmé. Un email de récapitulatif vous a
                été envoyé — le détail ci-dessous reste consultable à tout
                moment depuis votre espace client.
              </p>
            </div>
          </div>
        )}
        {fromPayment && order.status === "pending_payment" && (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
            Votre paiement n&apos;est pas encore confirmé. Si vous venez de le
            valider, patientez quelques instants et rechargez la page ; sinon,
            vous pouvez le reprendre depuis le bouton ci-dessous.
          </div>
        )}

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
            {/* Le numéro de facture n'était affiché que côté admin ;
                le client, qui en a besoin pour sa comptabilité, devait
                ouvrir le PDF pour le lire. */}
            {invoiceLabel(order) && (
              <p className="mt-0.5 text-sm font-semibold text-signal">
                Facture {invoiceLabel(order)}
              </p>
            )}
            <OrderDates order={order} />
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
                Payer maintenant — {formatEuro(order.total_ttc)}
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
            <OrderItems items={order.items} />
          </section>

          {/* Colonne récap */}
          <aside className="space-y-6">
            {/* Adresse livraison */}
            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Livraison
              </p>
              <AddressBlock address={addr} fallbackLabel="Adresse de livraison" />
              <p className="mt-3 text-xs text-ink-muted">
                Mode :{" "}
                {order.delivery_mode === "home"
                  ? "domicile"
                  : "montage en garage partenaire"}
              </p>
            </div>

            {/* Rendez-vous de montage : le client retrouve son créneau et
                peut le déplacer lui-même, sans appeler le garage. */}
            {order.delivery_mode === "partner_garage" && (
              <AppointmentCard order={order} onChange={setOrder} />
            )}

            {billingDiffers && (
              <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                  Facturation
                </p>
                <AddressBlock address={billing} fallbackLabel="Adresse de facturation" />
              </div>
            )}

            {/* Suivi expédition */}
            {(order.status === "shipped" || order.status === "delivered") && (
              <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                  Suivi de colis
                </p>
                <TrackingBlock order={order} />
              </div>
            )}

            {/* Récap montants */}
            <div className="rounded-2xl border border-line bg-paper p-6 shadow-card">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
                Récapitulatif
              </p>
              <OrderTotals order={order} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
