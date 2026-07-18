"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  accountApi,
  clearTokens,
  useCurrentUser,
  type Address,
  type OrderSummary,
} from "@/lib/auth";
import { clearCartSession } from "@/lib/cart";
import { PageSkeleton } from "@/components/Skeleton";
import { type Tab } from "@/components/compte/shared";
import { OverviewTab } from "@/components/compte/OverviewTab";
import { OrdersTab } from "@/components/compte/OrdersTab";
import { AddressesTab } from "@/components/compte/AddressesTab";
import { SecurityTab } from "@/components/compte/SecurityTab";
import { PrivacyTab } from "@/components/compte/PrivacyTab";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: "▦" },
  { id: "orders", label: "Mes commandes", icon: "🛒" },
  { id: "addresses", label: "Adresses", icon: "📍" },
  { id: "security", label: "Sécurité", icon: "🔐" },
  { id: "privacy", label: "Mes données", icon: "🛡" },
];

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-6 py-12">
            <PageSkeleton />
          </main>
        </>
      }
    >
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") as Tab) || "overview";
  const { user, loading } = useCurrentUser();
  const [tab, setTab] = useState<Tab>(initialTab);

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    accountApi.listOrders().then(setOrders).catch(() => setOrders([]));
    accountApi.listAddresses().then(setAddresses).catch(() => setAddresses([]));
  }, [user]);

  function changeTab(t: Tab) {
    setTab(t);
    const params = new URLSearchParams(sp.toString());
    if (t === "overview") params.delete("tab"); else params.set("tab", t);
    router.replace(`/compte${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function logout() {
    clearTokens();
    clearCartSession();
    router.push("/");
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <PageSkeleton />
        </main>
      </>
    );
  }
  if (!user) return null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-signal">Mon compte</p>
            <h1 className="mt-1 font-display text-3xl font-black tracking-tightest text-ink">
              {user.first_name ? `Bonjour, ${user.first_name}` : "Bonjour"}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-signal hover:text-signal"
          >
            ⎋ Se déconnecter
          </button>
        </div>

        {/* Onglets */}
        <nav className="mb-8 flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id
                  ? "border-signal text-signal"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
              aria-current={tab === t.id ? "page" : undefined}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {tab === "overview" && <OverviewTab user={user} orders={orders} addresses={addresses} onTabChange={changeTab} />}
        {tab === "orders" && <OrdersTab orders={orders} />}
        {tab === "addresses" && <AddressesTab addresses={addresses} setAddresses={setAddresses} />}
        {tab === "security" && <SecurityTab user={user} />}
        {tab === "privacy" && <PrivacyTab onDeleted={logout} />}
      </main>
    </>
  );
}
