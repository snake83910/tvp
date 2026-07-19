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

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  // Un seul worker : le tunnel manipule un compte et un panier partagés
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
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
