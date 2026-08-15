/**
 * Tunnel d'achat complet, contre l'API réelle (catalogue Maxityre live) :
 *
 *   fiche produit → ajout panier (anonyme) → page panier (port + total)
 *   → connexion (fusion du panier anonyme) → checkout (adresse + CGV)
 *   → commande créée → paiement simulé → page de confirmation.
 *
 * Le stock fournisseur étant réel, le test itère sur plusieurs
 * références jusqu'à en trouver une ajoutable.
 */
import { expect, test } from "@playwright/test";
import { API, EMAIL, PASSWORD, findCandidates, login } from "./helpers";

const DIM = { width: 205, ratio: 55, diameter: 16 };

test("tunnel : produit → panier → connexion → checkout → paiement simulé", async ({
  page,
  request,
}) => {
  const apiToken = (await login(request)).access;
  const candidates = await findCandidates(request, DIM);
  expect(candidates.length, "aucun pneu 205/55R16 disponible").toBeGreaterThan(0);

  // ── Ajout au panier depuis la fiche produit (anonyme) ────────────
  let added = false;
  for (const t of candidates) {
    await page.goto(
      `/produit/${encodeURIComponent(t.supplier_ref)}` +
        `?w=${DIM.width}&h=${DIM.ratio}&d=${DIM.diameter}`,
    );
    const addBtn = page.getByRole("button", { name: /ajouter .* au panier/i });
    if (!(await addBtn.isVisible().catch(() => false))) continue;
    await addBtn.click();
    // Succès = confirmation « ajouté(s) au panier » (fiche ou mini-panier)
    try {
      await page
        .getByText(/ajoutés? au panier/i)
        .first()
        .waitFor({ timeout: 10_000 });
      added = true;
      break;
    } catch {
      // Stock réel insuffisant : référence suivante
    }
  }
  expect(added, "aucune référence ajoutable au panier").toBeTruthy();

  // ── Page panier : ligne article + livraison + total ──────────────
  await page.goto("/panier");
  await expect(page.getByText("Livraison estimée")).toBeVisible();
  await expect(page.getByText("Total TTC")).toBeVisible();
  await expect(page.getByText(/€/).first()).toBeVisible();

  // ── Connexion : le panier anonyme doit être fusionné ─────────────
  await page.goto("/connexion?next=/checkout");
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(/\/checkout/);

  // ── Checkout : adresse (existante ou nouvelle) + CGV ─────────────
  // La checkbox CGV n'apparaît que si le panier (fusionné) est chargé :
  // c'est aussi l'assertion que la fusion a fonctionné. On la cible par son
  // libellé : la page a aussi une case « facturation identique ».
  const cgv = page.getByRole("checkbox", {
    name: /accepte les conditions/i,
  });
  await expect(cgv).toBeVisible({ timeout: 20_000 });

  const hasExisting = await page
    .getByText("+ Ajouter une nouvelle adresse")
    .isVisible()
    .catch(() => false);
  if (!hasExisting) {
    await page.getByLabel("Adresse", { exact: true }).fill("1 rue des Tests");
    await page.getByLabel("Code postal").fill("75001");
    await page.getByLabel("Ville").fill("Paris");
  }
  await cgv.check();
  await page.getByRole("button", { name: /procéder au paiement/i }).click();

  // Le backend peut renvoyer des écarts de prix (revalidation live) :
  // dans ce cas le panier est aligné et on re-valide une fois.
  try {
    await page.waitForURL(/\/paiement\/CMD-/, { timeout: 30_000 });
  } catch {
    await expect(
      page.getByText(/prix fournisseur de certains articles a changé/i),
    ).toBeVisible();
    await page.getByRole("button", { name: /procéder au paiement/i }).click();
    await page.waitForURL(/\/paiement\/CMD-/, { timeout: 30_000 });
  }

  // ── Page paiement : récap + formulaire selon le provider ─────────
  await expect(page.getByText("Paiement sécurisé")).toBeVisible();
  await expect(page.getByText("Total TTC")).toBeVisible();
  const orderNumber = page.url().match(/\/paiement\/(CMD-[\d-]+)/)?.[1];
  expect(orderNumber, "numéro de commande dans l'URL").toBeTruthy();

  const simulateBtn = page.getByRole("button", {
    name: /simuler un paiement réussi/i,
  });
  // provider "sogecommerce" : le conteneur smartForm ne devient visible
  // qu'au KR.onFormReady — attendre sa visibilité valide que le
  // formulaire bancaire (thème néon) s'est réellement chargé.
  const sogeForm = page.locator("#soge-smartform");
  await expect(simulateBtn.or(sogeForm).first()).toBeVisible({
    timeout: 45_000,
  });
  await page.screenshot({
    path: "test-results/paiement.png",
    fullPage: true,
  });

  // Statut serveur : la commande existe et attend le paiement
  const auth = { Authorization: `Bearer ${apiToken}` };
  const orderRes = await request.get(`${API}/me/orders/${orderNumber}`, {
    headers: auth,
  });
  expect(orderRes.ok()).toBeTruthy();
  expect((await orderRes.json()).status).toBe("pending_payment");

  if (await simulateBtn.isVisible().catch(() => false)) {
    // Dev : on va au bout — paiement simulé puis page de confirmation
    await simulateBtn.click();
    await page.waitForURL(/\/commande\/CMD-/, { timeout: 30_000 });
    const paid = await request.get(`${API}/me/orders/${orderNumber}`, {
      headers: auth,
    });
    expect((await paid.json()).status).toBe("paid");
  } else {
    // Provider réel (mode TEST) : le tunnel s'arrête à l'initialisation.
    // On annule la commande de test pour ne pas polluer le compte.
    await request.post(`${API}/me/orders/${orderNumber}/cancel`, {
      headers: auth,
    });
  }
});
