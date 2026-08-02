"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PartnerHeader } from "@/components/partner/PartnerHeader";
import { useCurrentUser } from "@/lib/auth";

const PUBLIC_PATHS = ["/partenaire/login", "/partenaire/inscription"];

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname ?? "");

  useEffect(() => {
    if (isPublic || loading) return;
    if (!user) {
      router.replace("/partenaire/login");
      return;
    }
    if (user.role !== "garage") {
      router.replace("/");
    }
  }, [loading, user, router, isPublic]);

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-paper-dim">
      <PartnerHeader />
      {content}
    </div>
  );

  // Connexion / inscription : accessibles sans compte.
  if (isPublic) return shell(children);

  if (loading) {
    return shell(
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-ink-muted">Chargement…</p>
      </main>,
    );
  }

  if (!user || user.role !== "garage") return null;

  return shell(children);
}
