import { expect, type APIRequestContext } from "@playwright/test";

export const API = process.env.E2E_API_URL || "http://localhost:8000";

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
