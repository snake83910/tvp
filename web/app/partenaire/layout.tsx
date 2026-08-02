"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { useCurrentUser } from "@/lib/auth";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/partenaire/login";

  useEffect(() => {
    if (isLoginPage || loading) return;
    if (!user) {
      router.replace("/partenaire/login");
      return;
    }
    if (user.role !== "garage") {
      router.replace("/");
    }
  }, [loading, user, router, isLoginPage]);

  // La page de connexion partenaire n'est pas protégée.
  if (isLoginPage) {
    return (
      <>
        <SiteHeader />
        {children}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-16">
          <p className="text-ink-muted">Chargement…</p>
        </main>
      </>
    );
  }

  if (!user || user.role !== "garage") return null;

  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
