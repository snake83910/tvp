import { expect, type APIRequestContext } from "@playwright/test";

// L'API produit est versionnée. /health, /cron et /payment/ipn ne le
// sont pas — ce sont des surfaces opérationnelles, pas des API client.
export const API = `${process.env.E2E_API_URL || "http://localhost:8000"}/v1`;

/** Compte fixe réutilisé d'un run à l'autre : le crée à chaque exécution
 *  consommerait le quota d'inscription (3/h/IP). */
export const EMAIL = process.env.E2E_EMAIL || "e2e-tunnel@example.com";
export const PASSWORD = process.env.E2E_PASSWORD || "PneusE2e!2026-tvp";

export interface Session {
  access: string;
  refresh: string;
}

let cached: Promise<Session> | null = null;

/**
 * Session sur le compte de test, ouverte UNE SEULE FOIS par exécution.
 *
 * /auth/login est limité à 5 tentatives par minute et par IP. Chaque
 * fichier de test ayant son propre helper, la suite consommait ce quota
 * en quelques lancements rapprochés et échouait sur un message qui ne
 * désignait pas la cause. Les specs partagent désormais ce module, donc
 * cette promesse : une connexion par run, quel que soit le nombre de
 * tests qui la demandent.
 *
 * Le 401 (compte absent, base neuve) est le SEUL cas qui déclenche une
 * inscription. Tout autre statut remonte tel quel : un quota atteint ne
 * doit pas se déguiser en « ce compte n'existe pas ».
 */
export function login(request: APIRequestContext): Promise<Session> {
  cached ??= openSession(request);
  return cached;
}

async function openSession(request: APIRequestContext): Promise<Session> {
  const creds = { email: EMAIL, password: PASSWORD };
  let res = await request.post(`${API}/auth/login`, { data: creds });

  if (res.status() === 401) {
    const reg = await request.post(`${API}/auth/register`, {
      data: {
        ...creds,
        account_type: "particulier",
        first_name: "Test",
        last_name: "E2E",
      },
    });
    expect(reg.ok(), `inscription e2e : ${reg.status()}`).toBeTruthy();
    res = await request.post(`${API}/auth/login`, { data: creds });
  }

  if (res.status() === 429) {
    const retryAfter = res.headers()["retry-after"] ?? "?";
    throw new Error(
      `Quota de connexion atteint (429). Attendez ${retryAfter}s : l'API ` +
        `limite /auth/login à 5 tentatives par minute et par IP.`,
    );
  }
  expect(res.ok(), `connexion e2e : ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { access: body.access_token, refresh: body.refresh_token };
}

export interface CatalogItem {
  supplier_ref: string;
  stock: number | null;
}

/** Références d'une dimension, les mieux stockées en tête.
 *
 *  Le stock est réel : `null` signifie « inconnu en liste », la fiche
 *  détaillée pouvant révéler un refus à l'ajout. Les tests itèrent donc
 *  sur plusieurs candidats. */
export async function findCandidates(
  request: APIRequestContext,
  dim: { width: number; ratio: number; diameter: number },
): Promise<CatalogItem[]> {
  const res = await request.get(`${API}/search/dimensions`, {
    params: dim,
    timeout: 60_000,
  });
  expect(res.ok(), `recherche catalogue : ${res.status()}`).toBeTruthy();
  const items: CatalogItem[] = (await res.json()).items;
  return items
    .filter((t) => t.stock == null || t.stock >= 2)
    .sort((a, b) => Number(b.stock != null) - Number(a.stock != null))
    .slice(0, 8);
}


// ── Compte partenaire ─────────────────────────────────────────────

export const PARTNER_EMAIL =
  process.env.E2E_PARTNER_EMAIL || "e2e-partenaire@example.com";
export const PARTNER_PASSWORD =
  process.env.E2E_PARTNER_PASSWORD || "PneusE2e!2026-garage";

let cachedPartner: Promise<Session> | null = null;

/**
 * Session sur le compte garage de test, créé au besoin.
 *
 * Comme `login`, la promesse est mise en cache : /auth/login est limité
 * à 5 tentatives par minute, et /partner/register à 3 par heure. Une
 * seule inscription sur une base neuve, une seule connexion par run.
 */
export function loginPartner(request: APIRequestContext): Promise<Session> {
  cachedPartner ??= openPartnerSession(request);
  return cachedPartner;
}

async function openPartnerSession(
  request: APIRequestContext,
): Promise<Session> {
  const creds = { email: PARTNER_EMAIL, password: PARTNER_PASSWORD };
  let res = await request.post(`${API}/auth/login`, { data: creds });

  if (res.status() === 401) {
    // /partner/register est en multipart (il accepte un Kbis) et crée
    // le compte ET sa fiche garage d'un coup.
    const reg = await request.post(`${API}/partner/register`, {
      multipart: {
        email: PARTNER_EMAIL,
        password: PARTNER_PASSWORD,
        garage_name: "Garage E2E",
        address: "1 rue des Tests",
        postal_code: "69003",
        city: "Lyon",
        siret: "12345678900017",
        phone: "0400000000",
      },
    });
    expect(reg.ok(), `inscription partenaire e2e : ${reg.status()}`).toBeTruthy();
    res = await request.post(`${API}/auth/login`, { data: creds });
  }

  if (res.status() === 429) {
    throw new Error(
      "Quota de connexion atteint (429). L'API limite /auth/login à 5 " +
        "tentatives par minute et par IP.",
    );
  }
  expect(res.ok(), `connexion partenaire e2e : ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { access: body.access_token, refresh: body.refresh_token };
}
