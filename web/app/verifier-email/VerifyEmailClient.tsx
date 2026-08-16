"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EmailOtpForm } from "@/components/EmailOtpForm";
import { SiteHeader } from "@/components/SiteHeader";
import { auth, useCurrentUser } from "@/lib/auth";

/**
 * Vérification d'adresse hors tunnel : après une inscription, ou depuis
 * un rappel dans l'espace client.
 *
 * L'adresse est pré-remplie pour un visiteur connecté ; sinon il la
 * saisit. Elle n'est pas passée en paramètre d'URL : une adresse email
 * dans une barre d'adresse finit dans l'historique, les journaux du
 * serveur et le referer des pages suivantes.
 */
export function VerifyEmailClient() {
  const { user, loading } = useCurrentUser();
  const [done, setDone] = useState(false);
  const [sent, setSent] = useState(false);
  /** Garde en ref et non en état : la marquer par setState dans l'effet
   *  déclencherait un rendu en cascade, et l'information n'a pas besoin
   *  d'être rendue — seule l'issue de l'envoi l'est. */
  const asked = useRef(false);

  // Visiteur connecté et non vérifié : un code part tout de suite. Il
  // arrive de la page « votre adresse n'est pas confirmée », le clic
  // qui l'a amené ici vaut demande.
  useEffect(() => {
    if (!user || user.email_verified || asked.current) return;
    asked.current = true;
    // `finally` et pas `then` : un envoi raté ne doit pas laisser
    // l'écran bloqué sur « Envoi du code… ». Le formulaire s'affiche,
    // avec son bouton « Renvoyer ».
    auth.sendEmailOtp(user.email).finally(() => setSent(true));
  }, [user]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-lg px-6 py-16">
        {loading ? (
          <p className="text-ink-muted">Chargement…</p>
        ) : done || user?.email_verified ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center shadow-card">
            <h1 className="font-display text-2xl font-black text-ink">
              Adresse confirmée ✓
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Vos emails de suivi arriveront bien à destination.
            </p>
            <Link
              href="/compte"
              className="mt-6 inline-block rounded-full bg-signal px-6 py-3 text-sm font-bold text-white transition hover:bg-signal-dark"
            >
              Aller à mon compte
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-paper p-8 shadow-card">
            <h1 className="mb-2 font-display text-2xl font-black text-ink">
              Vérifier mon adresse email
            </h1>
            <p className="mb-6 text-sm text-ink-soft">
              C&apos;est par là que passent vos confirmations de commande,
              vos factures et votre suivi de livraison.
            </p>
            {/* Connecté : on attend que le code soit parti pour monter le
                formulaire. Sinon son compte à rebours de renvoi
                démarrerait avant l'envoi et se désynchroniserait du
                verrou serveur. */}
            {user && !sent ? (
              <p className="text-sm text-ink-muted">Envoi du code…</p>
            ) : (
              <EmailOtpForm
                email={user?.email}
                alreadySent={sent}
                onVerified={() => setDone(true)}
              />
            )}
          </div>
        )}
      </main>
    </>
  );
}
