"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth";

/**
 * Garde des espaces réservés aux clients (compte, panier, commandes…).
 * Un compte garage n'est pas un client : il est renvoyé vers son espace
 * partenaire. Renvoie `isGarage` pour masquer le contenu pendant la
 * redirection.
 */
export function useCustomerOnly(): { isGarage: boolean } {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const isGarage = !loading && user?.role === "garage";

  useEffect(() => {
    if (isGarage) router.replace("/partenaire");
  }, [isGarage, router]);

  return { isGarage: !!isGarage };
}
