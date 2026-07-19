"use client";

import { authFetch, getToken } from "@/lib/auth";

const CART_SESSION_KEY = "tvp_cart_session";

export function getCartSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CART_SESSION_KEY);
}

function saveCartSession(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CART_SESSION_KEY, token);
  }
}

export function clearCartSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CART_SESSION_KEY);
  }
}

export interface CartItem {
  id: string;
  supplier_ref: string;
  label: string;
  quantity: number;
  price_ht: number;
  price_ttc: number;
  dimension?: string | null;
  image_url?: string | null;
  season?: string | null;
  category?: string;
}

export interface Cart {
  id: string;
  session_token: string | null;
  items: CartItem[];
  total_ht: number;
  total_ttc: number;
  // Frais de port calculés par l'API (source de vérité serveur)
  shipping_ht: number;
  shipping_ttc: number;
  free_shipping: boolean;
  grand_total_ttc: number;
}

async function call<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  const session = getCartSession();
  if (session) headers["X-Cart-Session"] = session;

  // authFetch ajoute l'Authorization et rafraîchit la session sur 401
  const res = await authFetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const b = await res.json();
      detail = b.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const data = (await res.json()) as T & {
    session_token?: string | null;
  };
  // Mémorise TOUJOURS le token de panier renvoyé par le backend :
  // c'est LA vérité sur le panier que l'API a réellement utilisé.
  // (L'ancienne condition « seulement si non connecté » perdait le
  // panier quand un token d'auth expiré traînait en localStorage.)
  if (
    data &&
    typeof data === "object" &&
    "session_token" in data &&
    data.session_token
  ) {
    saveCartSession(data.session_token);
  }
  return data as T;
}

export const cartApi = {
  get: () => call<Cart | null>("/cart", "GET"),

  addItem: (item: {
    supplier_ref: string;
    width: number;
    ratio: number;
    diameter: number;
    quantity: number;
    category?: string;
  }) => call<Cart>("/cart/items", "POST", item),

  updateQty: (itemId: string, quantity: number) =>
    call<Cart>(`/cart/items/${itemId}`, "PATCH", { quantity }),

  removeItem: (itemId: string) =>
    call<Cart>(`/cart/items/${itemId}`, "DELETE"),

  merge: () => call<Cart>("/cart/merge", "POST"),

  validatePromo: (code: string) =>
    call<{
      valid: boolean;
      reason: string | null;
      code: string | null;
      description: string | null;
      discount_ttc: number;
    }>("/cart/promo/validate", "POST", { code }),

  checkout: (
    addressId: string,
    acceptTerms: boolean,
    deliveryMode = "home",
    promoCode?: string | null,
    // null = facturation identique à la livraison
    billingAddressId?: string | null,
  ) =>
    call<{
      order_number: string | null;
      status: string | null;
      total_ttc: number | null;
      price_changes: Array<{
        supplier_ref: string;
        label: string;
        old_ttc: number;
        new_ttc: number;
      }>;
    }>("/cart/checkout", "POST", {
      address_id: addressId,
      billing_address_id: billingAddressId || null,
      delivery_mode: deliveryMode,
      accept_terms: acceptTerms,
      promo_code: promoCode || null,
    }),
};
