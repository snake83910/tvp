"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearTokens, useCurrentUser } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/securite", label: "Sécurité 2FA" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;
    if (loading) return;
    if (!user) { router.replace("/admin/login"); return; }
    if (user.role !== "admin") { router.replace("/admin/login"); }
  }, [loading, user, router, isLoginPage]);

  // La page de login n'a pas la sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-paper-dim">
        <p className="text-ink-muted">Chargement…</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") return null;

  return (
    <div className="flex min-h-screen bg-paper-dim">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-paper">
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-base font-black text-signal">TVP Admin</p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</p>
        </div>
        <nav className="flex-1 p-3">
          {NAV.map(({ href, label }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "bg-signal/10 text-signal"
                    : "text-ink-soft hover:bg-paper-dim hover:text-ink"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <button
            onClick={() => {
              clearTokens();
              router.replace("/admin/login");
            }}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition hover:bg-signal-light hover:text-signal-dark"
          >
            <span className="mr-2">⎋</span>Déconnexion
          </button>
        </div>
      </aside>

      {/* Contenu */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
