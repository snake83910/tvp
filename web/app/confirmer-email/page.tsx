"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

const BROWSER_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ConfirmerEmailPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16"><p className="text-ink-muted">Vérification…</p></main>}>
        <Confirm />
      </Suspense>
    </>
  );
}

function Confirm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("error"); setMsg("Lien invalide."); return; }
    fetch(`${BROWSER_API}/auth/confirm-email-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (r) => {
      if (r.ok) setState("ok");
      else {
        const b = await r.json().catch(() => ({}));
        setState("error"); setMsg(b.detail ?? "Lien expiré ou invalide.");
      }
    }).catch(() => { setState("error"); setMsg("Erreur réseau."); });
  }, [token]);

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      {state === "pending" && <p className="text-ink-muted">Confirmation de votre nouvelle adresse…</p>}
      {state === "ok" && (
        <>
          <h1 className="font-display text-3xl font-black text-ok">Email confirmé ✓</h1>
          <p className="mt-3 text-sm text-ink-soft">Votre nouvelle adresse email est active.</p>
          <Link href="/compte" className="mt-6 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white">
            Accéder à mon compte
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="font-display text-3xl font-black text-signal-dark">Confirmation impossible</h1>
          <p className="mt-3 text-sm text-ink-soft">{msg}</p>
        </>
      )}
    </main>
  );
}
