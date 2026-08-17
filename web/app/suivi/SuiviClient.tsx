"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { apiBase } from "@/lib/apiBase";
import { errorMessage } from "@/lib/errors";
import { formatEuro } from "@/lib/money";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/orderStatus";

interface Tracking {
  order_number: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  delivery_mode: string;
  total_ttc: number;
  item_count: number;
  items: string[];
  tracking_number: string | null;
  carrier: string | null;
  tracking_url: string | null;
  garage_name: string | null;
  garage_city: string | null;
}

/** Étapes visibles par le client. `cart` n'y figure pas — il ne verra
 *  jamais ce numéro — et les issues (annulée, remboursée) sortent du
 *  fil : elles ne sont pas une progression, elles l'interrompent. */
const ETAPES = [
  { cle: "pending_payment", titre: "Commande enregistrée" },
  { cle: "paid", titre: "Paiement reçu" },
  { cle: "sent_to_supplier", titre: "En préparation" },
  { cle: "shipped", titre: "Expédiée" },
  { cle: "delivered", titre: "Livrée" },
];

const ISSUES = ["cancelled", "refunded"];

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function SuiviClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Tracking | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch(`${apiBase()}/orders/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber, email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? body.detail ?? "Erreur");
      setOrder(body as Tracking);
    } catch (err) {
      setError(errorMessage(err, "Recherche impossible"));
    } finally {
      setBusy(false);
    }
  }

  const etapeAtteinte = order ? ETAPES.findIndex((e) => e.cle === order.status) : -1;
  const interrompue = order ? ISSUES.includes(order.status) : false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
          Suivre ma commande
        </h1>
        <p className="mt-2 text-ink-soft">
          Pas besoin de compte : votre numéro de commande et votre adresse
          email suffisent. Le numéro figure sur votre email de confirmation,
          sous la forme CMD-2026-000123.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4 rounded-2xl border border-line bg-paper p-6 shadow-card"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
              Numéro de commande
            </span>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
              placeholder="CMD-2026-000123"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 font-mono text-sm text-ink outline-none transition focus:border-signal"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
              Adresse email de la commande
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@exemple.fr"
              className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none transition focus:border-signal"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
          >
            {busy ? "Recherche…" : "Voir ma commande"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-signal/40 bg-signal-light p-4 text-sm text-signal-dark"
          >
            {error}
          </p>
        )}

        {order && (
          <section className="mt-8 rounded-2xl border border-line bg-paper p-6 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
              <p className="font-mono text-sm text-ink-muted">
                {order.order_number}
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  STATUS_COLOR[order.status] ?? "bg-paper-dim text-ink-soft"
                }`}
              >
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            </div>

            <ul className="mt-4 space-y-1 text-sm text-ink-soft">
              {order.items.map((label, i) => (
                <li key={i}>{label}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-soft">
              {order.item_count} pneu{order.item_count > 1 ? "s" : ""} ·{" "}
              <span className="font-bold text-ink">
                {formatEuro(order.total_ttc)}
              </span>{" "}
              · commandée le {dateCourte(order.created_at)}
            </p>

            {interrompue ? (
              <p className="mt-6 rounded-xl bg-signal-light p-4 text-sm text-signal-dark">
                Cette commande a été{" "}
                {order.status === "refunded" ? "remboursée" : "annulée"}. Une
                question&nbsp;? Répondez à votre email de confirmation.
              </p>
            ) : (
              <ol className="mt-6 space-y-3">
                {ETAPES.map((etape, i) => {
                  const faite = i <= etapeAtteinte;
                  const courante = i === etapeAtteinte;
                  return (
                    <li key={etape.cle} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          faite
                            ? "bg-ok text-white"
                            : "border border-line bg-paper text-ink-muted"
                        }`}
                      >
                        {faite ? "✓" : i + 1}
                      </span>
                      <span
                        className={
                          courante
                            ? "font-bold text-ink"
                            : faite
                              ? "text-ink-soft"
                              : "text-ink-muted"
                        }
                      >
                        {etape.titre}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {order.tracking_number && (
              <div className="mt-6 rounded-xl bg-paper-dim p-4 text-sm">
                <p className="font-bold text-ink">
                  Colis {order.carrier ? `— ${order.carrier}` : ""}
                </p>
                <p className="mt-1 font-mono text-ink-soft">
                  {order.tracking_number}
                </p>
                {order.tracking_url && (
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-semibold text-signal hover:underline"
                  >
                    Suivre chez le transporteur →
                  </a>
                )}
              </div>
            )}

            {order.garage_name && (
              <div className="mt-4 rounded-xl bg-paper-dim p-4 text-sm text-ink-soft">
                <p className="font-bold text-ink">Montage prévu</p>
                <p className="mt-0.5">
                  {order.garage_name}
                  {order.garage_city ? ` — ${order.garage_city}` : ""}
                </p>
              </div>
            )}

            <p className="mt-6 border-t border-line pt-4 text-xs text-ink-muted">
              Pour vos factures et vos adresses,{" "}
              <Link
                href="/connexion"
                className="font-semibold text-signal hover:underline"
              >
                connectez-vous à votre compte
              </Link>
              .
            </p>
          </section>
        )}
      </main>
    </>
  );
}
