"use client";

import { authFetch } from "@/lib/auth";
import type { OrderDetail } from "@/lib/auth";
import { invoiceError, saveBlob } from "@/lib/download";

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `Erreur ${res.status}`;
    try {
      const b = await res.json();
      detail = b.detail || detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
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
}

export interface AdminOrderDetail extends OrderDetail {
  customer_email: string;
  customer_name: string | null;
  allowed_transitions: string[];
}

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
};
