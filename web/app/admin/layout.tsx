"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearTokens, useCurrentUser } from "@/lib/auth";
import { ToastProvider } from "@/components/admin/Toast";
import { IdleLogout } from "@/components/admin/IdleLogout";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { OnboardingTour } from "@/components/admin/OnboardingTour";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: "▦" },
  { href: "/admin/commandes", label: "Commandes", icon: "🛒" },
  { href: "/admin/kanban", label: "Kanban", icon: "▤" },
  { href: "/admin/calendrier", label: "Calendrier", icon: "📅" },
  { href: "/admin/profil", label: "Mon profil", icon: "👤" },
  { href: "/admin/securite", label: "Sécurité 2FA", icon: "🔐" },
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

  return <AdminShell user={user} pathname={pathname} onLogout={() => { clearTokens(); router.replace("/admin/login"); }}>{children}</AdminShell>;
}

function AdminShell({
  user,
  pathname,
  onLogout,
  children,
}: {
  user: { email: string };
  pathname: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Raccourcis clavier globaux
  useEffect(() => {
    let gMode = false;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.key === "/") {
        e.preventDefault();
        (document.querySelector('input[type="search"], input[placeholder*="Recherche"]') as HTMLInputElement | null)?.focus();
        return;
      }
      if (e.key === "g") {
        gMode = true;
        setTimeout(() => { gMode = false; }, 800);
        return;
      }
      if (gMode) {
        if (e.key === "d") window.location.href = "/admin";
        if (e.key === "c") window.location.href = "/admin/commandes";
        gMode = false;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const widthCls = collapsed ? "w-16" : "w-56";

  return (
    <ToastProvider>
      <IdleLogout />
      <CommandPalette />
      <OnboardingTour />
      <div className="flex min-h-screen bg-paper-dim">
        {/* Sidebar desktop */}
        <aside className={`${widthCls} hidden shrink-0 flex-col border-r border-line bg-paper transition-all md:flex`}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            {!collapsed && (
              <div>
                <p className="font-display text-base font-black text-signal">TVP Admin</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</p>
              </div>
            )}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="ml-auto rounded p-1 text-ink-muted hover:bg-paper-dim hover:text-signal"
              title={collapsed ? "Déplier" : "Réduire"}
              aria-label="Toggle sidebar"
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>
          <nav className="flex-1 p-3">
            {NAV.map(({ href, label, icon }) => {
              const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-signal/10 text-signal" : "text-ink-soft hover:bg-paper-dim hover:text-ink"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="text-base">{icon}</span>
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3">
            <button
              onClick={onLogout}
              title={collapsed ? "Déconnexion" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-ink-soft transition hover:bg-signal-light hover:text-signal-dark ${collapsed ? "justify-center" : ""}`}
            >
              <span>⎋</span>
              {!collapsed && <span>Déconnexion</span>}
            </button>
          </div>
        </aside>

        {/* Header mobile */}
        <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
          <p className="font-display text-base font-black text-signal">TVP Admin</p>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-line p-2 text-ink-soft"
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
        </header>

        {/* Sidebar mobile (overlay) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" onClick={() => setMobileOpen(false)}>
            <aside className="flex w-64 flex-col bg-paper" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-line px-5 py-4">
                <p className="font-display text-base font-black text-signal">TVP Admin</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{user.email}</p>
              </div>
              <nav className="flex-1 p-3">
                {NAV.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-dim"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
              <div className="border-t border-line p-3">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-signal-light hover:text-signal-dark"
                >
                  <span>⎋</span><span>Déconnexion</span>
                </button>
              </div>
            </aside>
            <div className="flex-1 bg-ink/40" />
          </div>
        )}

        {/* Contenu : centré avec max width pour grands écrans */}
        <main className="flex-1 overflow-auto p-4 pt-16 md:p-8 md:pt-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
