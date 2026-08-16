import { defineConfig } from "@playwright/test";

/**
 * E2E du tunnel d'achat.
 *
 * Prérequis : le backend Docker doit tourner (docker compose up -d) —
 * API sur http://localhost:8000, provider paiement "simulated".
 *
 * Le serveur Next est lancé sur un port dédié (3105) avec
 * NEXT_PUBLIC_API_URL pointant sur son PROPRE proxy /api (rewrite
 * next.config.js) : les appels navigateur restent same-origin, donc
 * pas de configuration CORS particulière côté API.
 */
const PORT = Number(process.env.E2E_WEB_PORT || 3105);

/**
 * En local : `npm run dev`, pour tester ce qu'on vient d'écrire sans
 * rebuild. En CI : un serveur de PRODUCTION (voir ci.yml), parce que le
 * mode dev compile chaque route à la première visite — des secondes
 * imprévisibles au milieu d'un test, c'est-à-dire de l'instabilité qui
 * n'a rien à voir avec le code testé. Et accessoirement, c'est le
 * bundle réellement livré qui est vérifié.
 */
const WEB_COMMAND = process.env.E2E_WEB_COMMAND || "npm run dev";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Un seul worker : le tunnel manipule un compte et un panier partagés
  workers: 1,
  // Une reprise en CI seulement : le catalogue y est déterministe, mais
  // le réseau du runner ne l'est pas. En local, zéro reprise — un test
  // qui passe à la seconde tentative doit se voir.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: WEB_COMMAND,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: String(PORT),
      NEXT_PUBLIC_API_URL: `http://localhost:${PORT}/api`,
      API_URL_INTERNAL: process.env.API_URL_INTERNAL || "http://localhost:8000",
      // Build isolé : ne pas partager .next avec un dev server déjà ouvert
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
