"use client";

import { getToken } from "@/lib/auth";

const BROWSER_API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CART_SESSION_KEY = "tvp_cart_session";

function getCartSession(): string | null {
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
}

export interface Cart {
  id: string;
  session_token: string | null;
  items: CartItem[];
  total_ht: number;
  total_ttc: number;
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
  if (token) headers.Authorization = `Bearer ${token}`;
  const session = getCartSession();
  if (session) headers["X-Cart-Session"] = session;

  const res = await fetch(`${BROWSER_API}${path}`, {
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
  // Mémorise le token de panier anonyme renvoyé par le backend
  if (
    !token &&
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
  }) => call<Cart>("/cart/items", "POST", item),

  updateQty: (itemId: string, quantity: number) =>
    call<Cart>(`/cart/items/${itemId}`, "PATCH", { quantity }),

  removeItem: (itemId: string) =>
    call<Cart>(`/cart/items/${itemId}`, "DELETE"),

  merge: () => call<Cart>("/cart/merge", "POST"),

checkout: (
    addressId: string,
    acceptTerms: boolean,
    deliveryMode = "home",
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
      delivery_mode: deliveryMode,
      accept_terms: acceptTerms,
    }),  
};
