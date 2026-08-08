import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests unitaires (logique pure : slugs, formatage monétaire, statuts…).
 * Séparés des e2e Playwright, qui vivent dans web/e2e et exigent un
 * backend Docker. Ici, aucun réseau ni navigateur : rapide, tourne en CI
 * sans dépendance externe.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
