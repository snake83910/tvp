"use client";

import { authFetch } from "@/lib/auth";
import type { OrderDetail } from "@/lib/auth";
import { invoiceError, saveBlob } from "@/lib/download";
import { apiError } from "@/lib/errors";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await apiError(res);
  return res.json() as Promise<T>;
}

export interface AdminStats {
  orders_by_status: Record<string, number>;
  revenue_total_ttc: number;
  orders_today: number;
  revenue_today_ttc: number;
  orders_30d?: number;
  revenue_30d_ttc?: number;
  avg_cart_ttc?: number;
  top_products?: { ref: string; label: string; qty: number; revenue_ttc: number }[];
  revenue_prev30_ttc?: number;
  orders_prev30?: number;
}

export interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface AdminOrderSummary {
  order_number: string;
  status: string;
  created_at: string;
  total_ttc: number;
  item_count: number;
  customer_email: string;
  customer_name: string | null;
}

export interface AdminCustomer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  account_type: string;
  role: string;
  company_name: string | null;
  email_verified: boolean;
  created_at: string;
  // Agrégats sur les commandes encaissées uniquement ; last_order_at
  // couvre tous les statuts (une commande en attente reste un signal).
  orders_count: number;
  revenue_ttc: number;
  last_order_at: string | null;
  // Adresse du carnet marquée par défaut (à défaut, la plus ancienne).
  // Distincte de celle figée dans une commande, que le client a pu
  // modifier depuis.
  address: {
    label: string | null;
    line1: string;
    line2: string | null;
    postal_code: string;
    city: string;
    country: string;
  } | null;
  addresses_count: number;
}

export interface AdminOrderDetail extends OrderDetail {
  customer_email: string;
  customer_name: string | null;
  allowed_transitions: string[];
}

export interface Garage {
  id: string;
  name: string;
  slug: string;
  address: string;
  postal_code: string;
  city: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  siret_verified: boolean;
  siret_company_name: string | null;
  kbis_path: string | null;
  description: string | null;
  hours: Record<string, unknown>;
  mounting_price_cents: number;
  services: string[];
  photo_url: string | null;
  payment_methods: string[];
  closures: GarageClosure[];
  pricing: GaragePricingRow[];
  photos: string[];
  // Prise de RDV en ligne : réglages d'exploitation, pilotés par le
  // partenaire lui-même (contrairement aux coordonnées).
  appointments_enabled: boolean;
  slot_minutes: number;
  slot_capacity: number;
  appointment_lead_days: number;
  is_published: boolean;
  owner_user_id: string | null;
}

export interface GarageClosure {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  label?: string;
}

export interface GaragePricingRow {
  vehicle: string; // voiture | suv | utilitaire | moto | runflat …
  size_min: number; // diamètre jante mini (pouces)
  size_max: number; // diamètre jante maxi (pouces)
  price_cents: number;
  label?: string;
}

export interface GaragePayload {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  description?: string | null;
  payment_methods?: string[];
  closures?: GarageClosure[];
  pricing?: GaragePricingRow[];
  hours?: Record<string, unknown>;
  mounting_price_cents?: number;
  services?: string[];
  photo_url?: string | null;
  appointments_enabled?: boolean;
  slot_minutes?: number;
  slot_capacity?: number;
  appointment_lead_days?: number;
  is_published?: boolean;
}

/** Champs de la fiche garage qu'un compte partenaire ne peut PAS envoyer :
 *  le backend répond 403. Ils ne se corrigent que côté admin. */
export type PartnerEditablePayload = Omit<
  Partial<GaragePayload>,
  "name" | "address" | "postal_code" | "city" | "phone" | "email" | "siret" | "is_published"
>;

export async function downloadAdminInvoice(orderNumber: string): Promise<void> {
  const res = await authFetch(`/admin/orders/${orderNumber}/invoice`);
  if (!res.ok) throw new Error(invoiceError(res.status));
  saveBlob(await res.blob(), `facture-${orderNumber}.pdf`);
}

export const adminApi = {
  getStats: () => call<AdminStats>("/admin/stats"),

  listOrders: (params?: {
    status?: string; q?: string; page?: number;
    from_date?: string; to_date?: string;
    min_amount?: number; max_amount?: number;
  }) => {
    const p = new URLSearchParams();
    if (params?.status) p.set("status", params.status);
    if (params?.q) p.set("q", params.q);
    if (params?.page) p.set("page", String(params.page));
    if (params?.from_date) p.set("from_date", params.from_date);
    if (params?.to_date) p.set("to_date", params.to_date);
    if (params?.min_amount != null) p.set("min_amount", String(params.min_amount));
    if (params?.max_amount != null) p.set("max_amount", String(params.max_amount));
    const qs = p.toString();
    return call<AdminOrderSummary[]>(`/admin/orders${qs ? `?${qs}` : ""}`);
  },

  listCustomers: (params?: {
    q?: string; account_type?: string; sort?: string; page?: number;
  }) => {
    const p = new URLSearchParams();
    if (params?.q) p.set("q", params.q);
    if (params?.account_type) p.set("account_type", params.account_type);
    if (params?.sort) p.set("sort", params.sort);
    if (params?.page) p.set("page", String(params.page));
    const qs = p.toString();
    return call<AdminCustomer[]>(`/admin/customers${qs ? `?${qs}` : ""}`);
  },

  getOrder: (orderNumber: string) =>
    call<AdminOrderDetail>(`/admin/orders/${orderNumber}`),

  updateStatus: (
    orderNumber: string,
    data: {
      status: string;
      tracking_number?: string;
      carrier?: string;
      tracking_url?: string;
      cancel_reason?: string;
    }
  ) => call<AdminOrderDetail>(`/admin/orders/${orderNumber}/status`, "PATCH", data),

  updateNote: (orderNumber: string, admin_note: string) =>
    call<AdminOrderDetail>(`/admin/orders/${orderNumber}/note`, "PATCH", { admin_note }),

  listAudit: (orderNumber: string) =>
    call<AuditEntry[]>(`/admin/orders/${orderNumber}/audit`),

  getSparkline: () => call<{ days: string[]; revenue: number[]; orders: number[] }>(`/admin/stats/sparkline`),

  getAttention: () =>
    call<{
      to_ship: AdminOrderSummary[];
      late: AdminOrderSummary[];
    }>(`/admin/orders-attention`),

  bulkEmail: (order_numbers: string[], subject: string, body: string) =>
    call<{ sent: number }>(`/admin/bulk-email`, "POST", { order_numbers, subject, body }),

  listGarages: () => call<Garage[]>("/admin/garages"),
  getGarage: (id: string) => call<Garage>(`/admin/garages/${id}`),
  createGarage: (data: GaragePayload) => call<Garage>("/admin/garages", "POST", data),
  updateGarage: (id: string, data: Partial<GaragePayload>) =>
    call<Garage>(`/admin/garages/${id}`, "PATCH", data),
  deleteGarage: async (id: string) => {
    const res = await authFetch(`/admin/garages/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
  },
  setGarageOwner: (id: string, email: string) =>
    call<Garage>(`/admin/garages/${id}/owner`, "PUT", { email }),
};

export async function downloadGarageKbis(id: string, slug: string): Promise<void> {
  const res = await authFetch(`/admin/garages/${id}/kbis`);
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  const blob = await res.blob();
  const ext = blob.type.includes("pdf") ? "pdf" : blob.type.includes("png") ? "png" : "jpg";
  saveBlob(blob, `kbis-${slug}.${ext}`);
}
