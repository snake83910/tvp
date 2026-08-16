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
  /** Montant réellement remboursé (euros), et sa date. Le remboursement
   *  se fait au back office de la banque : c'est cette valeur, pas le
   *  statut, qui permet de vérifier après coup ce qui a été rendu. */
  refunded: number | null;
  refunded_at: string | null;
  /** « sogecommerce » = exécuté par l'API bancaire, preuve archivée.
   *  « manual » = un admin déclare l'avoir fait au Back Office. */
  refund_mode: string | null;
  /** Le remboursement automatique est-il possible sur cette instance ? */
  refund_api_available: boolean;
  /** Dernière réponse de la banque sur le paiement. Explique pourquoi
   *  une commande en attente n'a pas été annulée automatiquement. */
  payment_check_result: string | null;
  payment_checked_at: string | null;
  /** Transmission au panier du fournisseur : date et compte rendu. */
  supplier_pushed_at: string | null;
  supplier_push_result: SupplierPushResult | null;
}

export interface SupplierPushLine {
  ref: string;
  label: string;
  ok: boolean;
  error?: string;
  quantity?: number;
  /** Prix d'ACHAT du jour chez le fournisseur, à comparer au prix de
   *  vente figé : c'est ici que la marge réelle se vérifie. */
  buy_price_ht?: number;
  sell_price_ht?: number;
  delivery?: string;
  /** Cette offre ne tient pas la date annoncée au client. */
  late?: boolean;
}

export interface SupplierPushResult {
  lines: SupplierPushLine[];
  /** Adresse de livraison créée (ou retrouvée) chez le fournisseur. */
  address?: { id: number; created: boolean; name: string; city: string } | null;
  address_error?: string | null;
  cart_id?: number;
  cart_count?: number;
  buy_total_ht?: number;
  partial?: boolean;
  late?: boolean;
  pushed_at?: string;
}

export interface PlateProviderSetting {
  /** siv | siv_only | midas */
  mode: string;
  modes: string[];
  /** SIV_API_KEY renseignée côté serveur ? Sans elle, le mode SIV est
   *  inopérant et le site retombe sur Midas (ou ne répond plus, en
   *  mode siv_only). */
  siv_configured: boolean;
  /** Appels du jour par fournisseur — le quota SIV se compte à la
   *  journée. */
  usage_today: Record<string, number>;
}

export interface PlateTestResult {
  provider: string;
  ok: boolean;
  dimensions?: string[];
  error: string | null;
}

export interface EmailTemplateSummary {
  name: string;
  /** Une surcharge est enregistrée : le fichier versionné n'est plus
   *  ce qui part aux clients. */
  modified: boolean;
  /** `_layout.html` : squelette commun, consultable mais non éditable. */
  locked: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface EmailTemplateDetail {
  name: string;
  /** Source actuellement utilisée (surcharge si elle existe). */
  html: string;
  /** Source du fichier versionné, pour comparer et revenir en arrière. */
  default_html: string;
  modified: boolean;
  locked: boolean;
}

export interface CronRunStatus {
  job: string;
  /** ok | error | late | never_ran */
  state: string;
  period_minutes: number;
  last_run?: string;
  duration_ms?: number | null;
  detail?: Record<string, unknown>;
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

/** Facture d'avoir d'une commande remboursée. Le nom du fichier porte
 *  la référence de l'avoir, pas celle de la commande : c'est la pièce
 *  comptable qu'on cherchera plus tard, et deux avoirs sur des
 *  commandes différentes ne doivent pas se ressembler. */
export async function downloadAdminCreditNote(
  orderNumber: string,
  ref: string,
): Promise<void> {
  const res = await authFetch(`/admin/orders/${orderNumber}/credit-note`);
  if (!res.ok) throw new Error(invoiceError(res.status));
  saveBlob(await res.blob(), `avoir-${ref}.pdf`);
}

/** Aperçu d'un template : la réponse est du HTML brut, pas du JSON.
 *
 *  Il est rendu dans une iframe cloisonnée côté admin — jamais injecté
 *  dans la page elle-même, qui porte une session administrateur. */
export async function previewEmailTemplate(
  name: string,
  html: string,
): Promise<string> {
  const res = await authFetch(`/admin/email-templates/${name}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) throw await apiError(res);
  return res.text();
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
      /** Obligatoire pour passer en « remboursée ». En centimes. */
      refund_cents?: number;
      /** true = déclarer un remboursement DÉJÀ fait au Back Office, au
       *  lieu de laisser le site appeler la banque. */
      refund_manual?: boolean;
    }
  ) => call<AdminOrderDetail>(`/admin/orders/${orderNumber}/status`, "PATCH", data),

  /** Ajoute les articles au panier Maxityre. N'achète rien : le panier
   *  fournisseur reste à valider à la main sur leur site. */
  pushToSupplier: (orderNumber: string) =>
    call<SupplierPushResult>(
      `/admin/orders/${orderNumber}/push-supplier`,
      "POST",
    ),

  updateNote: (orderNumber: string, admin_note: string) =>
    call<AdminOrderDetail>(`/admin/orders/${orderNumber}/note`, "PATCH", { admin_note }),

  listAudit: (orderNumber: string) =>
    call<AuditEntry[]>(`/admin/orders/${orderNumber}/audit`),

  getSparkline: () => call<{ days: string[]; revenue: number[]; orders: number[] }>(`/admin/stats/sparkline`),

  getAttention: () =>
    call<{
      to_ship: AdminOrderSummary[];
      late: AdminOrderSummary[];
      payment_stuck: AdminOrderSummary[];
    }>(`/admin/orders-attention`),

  /** Dernier passage de chaque job planifié. Un job « late » ou
   *  « never_ran » signale une ligne de crontab perdue — les relances
   *  de paiement et les rappels de rendez-vous s'arrêtent alors sans
   *  autre signal. */
  getCronRuns: () => call<CronRunStatus[]>(`/admin/cron-runs`),

  getPlateProvider: () =>
    call<PlateProviderSetting>(`/admin/settings/plate-provider`),

  setPlateProvider: (mode: string) =>
    call<PlateProviderSetting>(`/admin/settings/plate-provider`, "PATCH", {
      mode,
    }),

  /** Déclenche un job planifié à la main. Il peut envoyer des emails
   *  et annuler des commandes : l'écran demande confirmation. */
  runCronJob: (job: string) =>
    call<{ job: string; result: Record<string, unknown> }>(
      `/admin/cron-runs/${job}/run`,
      "POST",
    ),

  listEmailTemplates: () =>
    call<EmailTemplateSummary[]>(`/admin/email-templates`),

  getEmailTemplate: (name: string) =>
    call<EmailTemplateDetail>(`/admin/email-templates/${name}`),

  saveEmailTemplate: (name: string, html: string) =>
    call<{ name: string; modified: boolean }>(
      `/admin/email-templates/${name}`,
      "PUT",
      { html },
    ),

  resetEmailTemplate: (name: string) =>
    call<{ name: string; modified: boolean; was_modified: boolean }>(
      `/admin/email-templates/${name}`,
      "DELETE",
    ),

  /** Interroge les deux fournisseurs et rapporte ce que chacun répond.
   *  Consomme un appel de quota par fournisseur. */
  testPlateProvider: (plate: string) =>
    call<{ plate: string; results: PlateTestResult[] }>(
      `/admin/settings/plate-provider/test?plate=${encodeURIComponent(plate)}`,
    ),

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
