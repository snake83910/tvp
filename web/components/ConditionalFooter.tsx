"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Affiche le footer sauf sur les espaces qui ont leur propre layout
 * (admin, espace partenaire).
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/partenaire"))
    return null;
  return <SiteFooter />;
}
