/**
 * Espace partenaire, contre l'API réelle.
 *
 * Il n'avait AUCUN test alors qu'il porte le quotidien des garages
 * (planning, créneaux, tarifs) et qu'il a été lourdement remanié : les
 * onglets sont désormais partagés avec l'admin. Chaque refonte se
 * vérifiait à la main — ça ne tient pas dans la durée.
 *
 * Ce test couvre le chemin quotidien et les deux garde-fous qui font la
 * valeur de l'espace : les coordonnées verrouillées, et les créneaux
 * déduits des horaires.
 *
 * Prérequis : backend Docker lancé (docker compose up -d).
 */
import { expect, test } from "@playwright/test";
import { API, loginPartner, signIn } from "./helpers";

test("espace partenaire : fiche, coordonnées verrouillées et réglage des créneaux", async ({
  page,
  request,
}) => {
  const tokens = await loginPartner(request);
  await signIn(page, tokens, "/connexion?next=/partenaire");

  await page.goto("/partenaire");

  // ── La fiche du garage s'affiche ────────────────────────────────
  await expect(
    page.getByRole("button", { name: "Rendez-vous montage" }),
  ).toBeVisible({ timeout: 20_000 });

  // ── Coordonnées : lecture seule ─────────────────────────────────
  // Le cœur de la règle métier : le partenaire ne corrige pas lui-même
  // une adresse figée dans ses commandes. L'écran doit donc proposer un
  // contact, pas un formulaire.
  await page.getByRole("button", { name: "Coordonnées" }).click();
  await expect(
    page.getByRole("link", { name: /demander une modification/i }),
  ).toBeVisible();
  // La présentation, elle, reste éditable.
  await expect(page.getByText("Présentation")).toBeVisible();

  // ── Horaires : la grille par jour est bien saisissable ──────────
  await page.getByRole("button", { name: "Horaires" }).click();
  // exact : sans lui, « Lundi » matche aussi le bouton
  // « Appliquer au lundi–vendredi » et Playwright refuse l'ambiguïté.
  await expect(page.getByText("Lundi", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Appliquer au lundi/i }),
  ).toBeVisible();

  // ── Rendez-vous : réglages + délai imposé par le site ───────────
  await page.getByRole("button", { name: "Rendez-vous montage" }).click();
  await expect(page.getByText("Réglage des créneaux")).toBeVisible();
  // Le délai après livraison est une décision du site : le partenaire le
  // lit, il ne le change pas.
  await expect(page.getByText(/fixé par tousvospneus\.com/i)).toBeVisible();
  await expect(page.getByText(/Capacité hebdomadaire estimée/i)).toBeVisible();
});

test("le backend refuse qu'un partenaire modifie ses coordonnées", async ({
  request,
}) => {
  // Le verrou de l'interface ne vaut que si le serveur tient la même
  // ligne : un PATCH direct doit être refusé, avec un code exploitable.
  const tokens = await loginPartner(request);
  const res = await request.patch(`${API}/partner/garage`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: { address: "999 rue Contournement" },
  });
  expect(res.status(), "les coordonnées doivent être refusées").toBe(403);
  const body = await res.json();
  expect(body.code).toBe("garage_fields_locked");
  expect(body.details.fields).toContain("address");
});

test("le partenaire règle ses créneaux, le site garde la main sur le délai", async ({
  request,
}) => {
  const tokens = await loginPartner(request);
  const auth = { Authorization: `Bearer ${tokens.access}` };

  // Réglages d'exploitation : acceptés.
  const ok = await request.patch(`${API}/partner/garage`, {
    headers: auth,
    data: { slot_minutes: 45, slot_capacity: 3 },
  });
  expect(ok.ok(), `réglage créneaux : ${ok.status()}`).toBeTruthy();
  const garage = await ok.json();
  expect(garage.slot_minutes).toBe(45);
  expect(garage.slot_capacity).toBe(3);

  // Délai après livraison : politique du site, refusé au partenaire.
  const refused = await request.patch(`${API}/partner/garage`, {
    headers: auth,
    data: { appointment_lead_days: 5 },
  });
  expect(refused.status()).toBe(403);

  // Remise en état pour que le run suivant reparte du même point.
  await request.patch(`${API}/partner/garage`, {
    headers: auth,
    data: { slot_minutes: 30, slot_capacity: 1 },
  });
});
