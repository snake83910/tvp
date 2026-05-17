"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { clearTokens, useCurrentUser } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  if (!user) return null;

  function logout() {
    clearTokens();
    router.push("/");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-black tracking-tightest text-ink">
            Mon compte
          </h1>
          <button
            onClick={logout}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-signal hover:text-signal"
          >
            Se déconnecter
          </button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card title="Identité">
            <p className="text-ink">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-sm text-ink-muted">{user.email}</p>
          </Card>

          <Card title="Type de compte">
            <p className="capitalize text-ink">{user.account_type}</p>
            <p className="text-sm text-ink-muted">
              Prix affichés TTC
            </p>
          </Card>

          <Card title="Mes commandes">
            <p className="text-sm text-ink-muted">
              Aucune commande pour l'instant. Vos achats
              apparaîtront ici.
            </p>
          </Card>

          <Card title="Mes adresses">
            <p className="text-sm text-ink-muted">
              Gérez vos adresses de livraison (bientôt).
            </p>
          </Card>
        </div>
      </main>
    </>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-6 shadow-card">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-ink-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
