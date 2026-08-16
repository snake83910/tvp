"use client";

import { authFetch, getToken } from "@/lib/auth";
import { ApiError, apiError } from "@/lib/errors";

const CART_SESSION_KEY = "tvp_cart_session";

/** Erreur d'appel panier.
 *
 *  Hérite d'ApiError : elle porte donc le `code` du backend
 *  (`stock_insufficient`, `cart_empty`…) comme n'importe quelle autre
 *  erreur d'API. `available` est un raccourci vers `details.available`,
 *  renseigné sur les conflits de stock — il porte la quantité encore
 *  commandable, ce qui permet de proposer un ajustement plutôt qu'un
 *  simple refus. */
export class CartError extends ApiError {
  constructor(e: ApiError) {
    super(e.code, e.message, e.status, e.details);
    this.name = "CartError";
  }

  get available(): number | undefined {
    const v = this.details.available;
    return typeof v === "number" ? v : undefined;
  }
}

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
  // Livraison estimée du panier (YYYY-MM-DD), la plus tardive des lignes.
  // null si le fournisseur ne la communique pas.
  delivery_estimate?: string | null;
}

export interface MountingSlot {
  start: string; // ISO 8601, heure locale du garage
  available: boolean;
}

export interface MountingSlotDay {
  date: string; // YYYY-MM-DD
  closure_label: string | null;
  slots: MountingSlot[];
}

/** Créneaux de montage proposables pour le panier courant. Le premier
 *  jour réservable est calculé par le serveur (livraison estimée + délai
 *  du garage) : le front l'affiche, il ne le recalcule pas. */
export interface MountingSlots {
  enabled: boolean;
  delivery_estimate: string | null;
  earliest_date: string;
  slot_minutes: number;
  days: MountingSlotDay[];
}

async function call<T>(
  path: string,
  method: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  const session = getCartSession();
  if (session) headers["X-Cart-Session"] = session;
  // Reprise après coupure : rejouée avec la même clé, la requête rend la
  // commande déjà créée au lieu d'en créer une seconde.
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  // authFetch ajoute l'Authorization et rafraîchit la session sur 401
  const res = await authFetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Le backend renvoie une enveloppe unique : plus de tri manuel entre
  // `detail` chaîne et `detail` objet, le contexte est dans `details`.
  if (!res.ok) throw new CartError(await apiError(res));
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

  /** Créneaux de montage d'un garage pour le panier courant. Passe par le
   *  même appel que le panier : le serveur a besoin de l'en-tête de
   *  session pour retrouver les articles et en déduire la date au plus
   *  tôt. */
  mountingSlots: (garageId: string, days = 21) =>
    call<MountingSlots>(`/garages/${garageId}/slots?days=${days}`, "GET"),

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
    garageId?: string | null,
    // Créneau de montage choisi (ISO local), si le garage prend des RDV
    mountingAt?: string | null,
    idempotencyKey?: string,
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
      garage_id: garageId || null,
      mounting_at: mountingAt || null,
      accept_terms: acceptTerms,
      promo_code: promoCode || null,
    }, idempotencyKey),

  /** Commande sans compte préalable. Le backend crée le compte support et
   *  rend une paire de jetons : le tunnel de paiement exige un utilisateur
   *  authentifié, et l'appelant doit donc les enregistrer avant de
   *  poursuivre vers /paiement. */
  checkoutGuest: (payload: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    shipping: AddressPayload;
    billing?: AddressPayload | null;
    delivery_mode?: string;
    garage_id?: string | null;
    mounting_at?: string | null;
    accept_terms: boolean;
    promo_code?: string | null;
  }, idempotencyKey?: string) =>
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
      access_token: string | null;
      refresh_token: string | null;
    }>("/cart/checkout/guest", "POST", {
      ...payload,
      phone: payload.phone || null,
      billing: payload.billing ?? null,
      delivery_mode: payload.delivery_mode ?? "home",
      garage_id: payload.garage_id || null,
      mounting_at: payload.mounting_at || null,
      promo_code: payload.promo_code || null,
    }, idempotencyKey),
};

export interface AddressPayload {
  line1: string;
  line2?: string | null;
  postal_code: string;
  city: string;
  country: string;
  label?: string | null;
}
