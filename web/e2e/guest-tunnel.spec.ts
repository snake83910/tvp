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
import { expect, test } from "@playwright/test";
import { API, findCandidates, login, type CatalogItem } from "./helpers";

const DIM = { width: 205, ratio: 55, diameter: 16 };

/** Email neuf à chaque run : le checkout invité refuse — volontairement —
 *  toute adresse déjà enregistrée, donc un email fixe ne passerait qu'une
 *  seule fois dans la vie de la base. */
function freshEmail(): string {
  return `e2e-invite-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
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
  // Ciblage par nom, pas par position : le tunnel unifié porte aussi la
  // case « facturation identique », qui vient avant dans le DOM.
  await page
    .getByRole("checkbox", { name: /conditions générales/i })
    .check();
}

test("tunnel invité : panier anonyme → commande sans compte → paiement", async ({
  page,
  request,
}) => {
  const candidates = await findCandidates(request, DIM);
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
  await expect(commander).toHaveAttribute("href", "/checkout");
  await expect(page.getByRole("link", { name: /déjà un compte/i })).toBeVisible();

  // ── Formulaire invité ───────────────────────────────────────────────
  await commander.click();
  await page.waitForURL(/\/checkout(\?|$)/);
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
      // Téléphone valide EXPRÈS : sans lui la requête est refusée en 422
      // sur la validation, et ce test-ci ne vérifierait plus la garde
      // qu'il cible — le refus d'un email déjà enregistré.
      phone: "0611223344",
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

test("tunnel unique : l'ancienne URL redirige, et le connecté n'a pas à ressaisir son identité", async ({
  page,
  request,
}) => {
  // Les deux tunnels (/checkout et /checkout/invite) ont fusionné. Deux
  // choses doivent rester vraies : l'ancienne adresse continue d'aboutir,
  // et la page unique s'adapte — un client connecté ne doit pas se voir
  // redemander email, nom et prénom que son compte porte déjà.
  //
  // La session injectée est une VRAIE session, pas un jeton bidon : au
  // chargement, le panier appelle l'API via authFetch, qui sur 401 tente
  // un refresh puis EFFACE les jetons. Le test devenait alors instable
  // pour une raison sans rapport avec ce qu'il vérifie.
  const tokens = await login(request);

  await page.goto("/panier");
  await page.evaluate((t) => {
    localStorage.setItem("tvp_access", t.access);
    localStorage.setItem("tvp_refresh", t.refresh);
  }, tokens);

  // L'ancienne URL du tunnel invité aboutit toujours.
  await page.goto("/checkout/invite");
  await page.waitForURL(/\/checkout(\?|$)/, { timeout: 20_000 });
  expect(page.url()).not.toContain("/checkout/invite");

  // Et le tunnel est en mode « compte » : pas de saisie d'identité.
  await expect(page.getByText("Vos coordonnées")).toHaveCount(0);
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
});
