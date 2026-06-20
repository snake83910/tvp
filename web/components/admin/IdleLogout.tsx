"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { clearTokens } from "@/lib/auth";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Déconnexion auto après 30 min sans activité.
 * Réinitialise le timer à chaque mousemove / keydown / scroll.
 */
export function IdleLogout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearTokens();
        alert("Session expirée après 30 min d'inactivité. Vous allez être déconnecté.");
        router.replace("/admin/login");
      }, IDLE_LIMIT_MS);
    }

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return null;
}
