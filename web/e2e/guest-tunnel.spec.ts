/**
 * Tunnel de commande SANS COMPTE, contre l'API réelle :
 *
 *   recherche → ajout panier (anonyme) → page panier (chemin invité mis
 *   en avant) → formulaire invité → commande créée → page de paiement.
 *
 * Puis la garde de sécurité qui rend ce parcours acceptable : rejouer le
 * même email doit être REFUSÉ. L'endpoint rend une paire de jetons ;
 * accepter une adresse déjà enregistrée reviendrait à offrir une session
 * sur le compte d'un tiers, donc l'accès à ses commandes et ses factures.
 *
 * Prérequis : backend Docker lancé (docker compose up -d).
 */
import { expect, test, type APIRequestContext } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:8000";
const DIM = { width: 205, ratio: 55, diameter: 16 };

/** Email neuf à chaque run : le checkout invité refuse — volontairement —
 *  toute adresse déjà enregistrée, donc un email fixe ne passerait qu'une
 *  seule fois dans la vie de la base. */
function freshEmail(): string {
  return `e2e-invite-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

interface CatalogItem {
  supplier_ref: string;
  stock: number | null;
}

async function findCandidates(
  request: APIRequestContext,
): Promise<CatalogItem[]> {
  const res = await request.get(`${API}/search/dimensions`, {
    params: DIM,
    timeout: 60_000,
  });
  expect(res.ok(), `recherche catalogue : ${res.status()}`).toBeTruthy();
  const items: CatalogItem[] = (await res.json()).items;
  // Stock explicite >= 2 en tête : le stock null n'est qu'inconnu en
  // liste, la fiche détaillée peut révéler un refus à l'ajout.
  return items
    .filter((t) => t.stock == null || t.stock >= 2)
    .sort((a, b) => Number(b.stock != null) - Number(a.stock != null))
    .slice(0, 8);
}

/** Ajoute une référence au panier anonyme via l'UI. Le stock fournisseur
 *  est réel : on essaie plusieurs références avant d'abandonner. */
async function addSomethingToCart(page: import("@playwright/test").Page, candidates: CatalogItem[]) {
  for (const t of candidates) {
    await page.goto(
      `/produit/${encodeURIComponent(t.supplier_ref)}` +
        `?w=${DIM.width}&h=${DIM.ratio}&d=${DIM.diameter}`,
    );
    const addBtn = page.getByRole("button", { name: /ajouter .* au panier/i });
    if (!(await addBtn.isVisible().catch(() => false))) continue;
    await addBtn.click();
    try {
      await page.getByText(/ajoutés? au panier/i).first().waitFor({ timeout: 10_000 });
      return true;
    } catch {
      // Stock réel insuffisant : référence suivante
    }
  }
  return false;
}

async function fillGuestForm(page: import("@playwright/test").Page, email: string) {
  // exact: true partout — sans lui, « Nom » matche aussi « Prénom » et
  // Playwright refuse le locator ambigu.
  const champ = (nom: string) => page.getByLabel(nom, { exact: true });
  await champ("Email").fill(email);
  await champ("Prénom").fill("Camille");
  await champ("Nom").fill("Durand");
  await champ("Téléphone").fill("0611223344");
  await champ("Adresse").fill("8 rue des Verifications");
  await champ("Code postal").fill("13100");
  await champ("Ville").fill("Aix-en-Provence");
  await page.getByRole("checkbox").first().check();
}

test("tunnel invité : panier anonyme → commande sans compte → paiement", async ({
  page,
  request,
}) => {
  const candidates = await findCandidates(request);
  expect(candidates.length, "aucun pneu 205/55R16 disponible").toBeGreaterThan(0);

  const added = await addSomethingToCart(page, candidates);
  expect(added, "aucune référence ajoutable au panier").toBeTruthy();

  // ── Panier : la commande sans compte doit être le chemin PRINCIPAL ──
  // Assertion de parcours autant que d'affichage : si « Passer commande »
  // repointait vers /connexion, on serait revenu à l'inscription forcée
  // sans que rien d'autre ne casse.
  await page.goto("/panier");
  const commander = page.getByRole("link", { name: /passer commande/i });
  await expect(commander).toBeVisible();
  await expect(commander).toHaveAttribute("href", "/checkout/invite");
  await expect(page.getByRole("link", { name: /déjà un compte/i })).toBeVisible();

  // ── Formulaire invité ───────────────────────────────────────────────
  await commander.click();
  await page.waitForURL(/\/checkout\/invite/);
  const email = freshEmail();
  await fillGuestForm(page, email);
  await page.getByRole("button", { name: /continuer vers le paiement/i }).click();

  // ── Commande créée → page de paiement ───────────────────────────────
  await page.waitForURL(/\/paiement\/CMD-/, { timeout: 60_000 });
  const orderNumber = page.url().split("/paiement/")[1];
  expect(orderNumber).toMatch(/^CMD-\d{4}-\d+$/);

  // La page de paiement exige une session : sans les jetons rendus par le
  // checkout invité, le client arriverait devant un écran qui le rejette
  // alors que sa commande vient d'être créée.
  const token = await page.evaluate(() => localStorage.getItem("tvp_access"));
  expect(token, "jeton d'accès absent après checkout invité").toBeTruthy();

  await expect(page.getByText(orderNumber)).toBeVisible();
  await expect(page.getByText(/Total TTC/i)).toBeVisible();

  // ── SÉCURITÉ : le même email ne doit plus passer ─────────────────────
  // Il vient d'être enregistré par la commande ci-dessus. Le rejouer
  // simule quelqu'un qui saisit l'adresse d'un tiers pour obtenir une
  // session sur son compte.
  const rejeu = await request.post(`${API}/cart/checkout/guest`, {
    headers: { "X-Cart-Session": "session-inexistante-pour-ce-test" },
    data: {
      email,
      first_name: "Pirate",
      last_name: "Malveillant",
      shipping: {
        line1: "1 rue du Vol",
        postal_code: "75001",
        city: "Paris",
        country: "FR",
      },
      delivery_mode: "home",
      accept_terms: true,
    },
  });
  expect(rejeu.status(), "un email déjà enregistré doit être refusé").toBe(409);
  const corps = await rejeu.json();
  expect(JSON.stringify(corps)).toMatch(/compte existe déjà/i);
  // Et surtout : aucun jeton ne doit être rendu sur ce refus.
  expect(corps.access_token ?? null).toBeNull();
});

test("checkout invité : un client déjà connecté est renvoyé vers le tunnel complet", async ({
  page,
}) => {
  // Un client connecté a ses adresses enregistrées : lui créer un second
  // compte invité dupliquerait son historique sur deux identités.
  //
  // Le test pose directement un jeton en session au lieu de dérouler une
  // vraie commande invité. Deux raisons : la redirection testée ne dépend
  // que de la PRÉSENCE d'un jeton (cf. getToken() dans la page), et une
  // seconde commande consommerait le quota de /cart/checkout/guest
  // (5 par 10 min et par IP) — le test deviendrait rouge au bout de
  // quelques exécutions rapprochées, pour une raison sans rapport avec ce
  // qu'il vérifie.
  await page.goto("/panier");
  await page.evaluate(() => {
    localStorage.setItem("tvp_access", "jeton-de-test-e2e");
    localStorage.setItem("tvp_refresh", "refresh-de-test-e2e");
  });

  await page.goto("/checkout/invite");
  await page.waitForURL(/\/checkout(\?|$)/, { timeout: 20_000 });
  expect(page.url()).not.toContain("/checkout/invite");
});
