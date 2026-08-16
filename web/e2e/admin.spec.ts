/**
 * Espace administrateur, contre l'API réelle.
 *
 * C'est l'écran le plus coûteux à casser du site : chaque changement de
 * statut déclenche un EMAIL au client (« expédiée », « livrée »,
 * « annulée ») et deux transitions engagent de l'argent (`refunded`,
 * `cancelled`). Une régression ici ne se voit pas en recette — elle se
 * voit dans la boîte mail des clients, une fois envoyée.
 *
 * Ce fichier couvre donc trois choses, dans cet ordre d'importance :
 *
 *   1. la machine à états tient au niveau de l'API (aucun saut d'état,
 *      aucun retour arrière), même quand l'appel vient d'un admin ;
 *   2. l'espace est fermé — un client authentifié n'y entre pas ;
 *   3. le parcours quotidien (ouvrir une commande, changer son statut,
 *      retrouver la trace dans l'audit) fonctionne de bout en bout.
 *
 * Prérequis : backend Docker lancé, et le compte admin de test semé
 * (voir `loginAdmin` dans helpers.ts).
 */
import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  ADMIN_EMAIL,
  API,
  findCandidates,
  login,
  loginAdmin,
  signIn,
  type Session,
} from "./helpers";

const DIM = { width: 205, ratio: 55, diameter: 16 };

interface SeededOrder {
  orderNumber: string;
  email: string;
}

function freshEmail(): string {
  return `e2e-admin-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.com`;
}

/**
 * Fabrique une commande PAYÉE, par l'API.
 *
 * Le test a besoin d'une commande dans un état précis, pas d'un second
 * test de tunnel : passer par l'UI rejouerait le parcours déjà couvert
 * par guest-tunnel.spec.ts et rendrait cet échec-ci illisible.
 *
 * Le stock fournisseur est réel : on essaie plusieurs références.
 */
async function seedPaidOrder(request: APIRequestContext): Promise<SeededOrder> {
  const candidates = await findCandidates(request, DIM);
  expect(candidates.length, "aucun pneu 205/55R16 disponible").toBeGreaterThan(0);

  let session: string | null = null;
  for (const t of candidates) {
    const res = await request.post(`${API}/cart/items`, {
      headers: session ? { "X-Cart-Session": session } : {},
      data: { supplier_ref: t.supplier_ref, ...DIM, quantity: 2 },
      timeout: 60_000,
    });
    if (res.ok()) {
      session = (await res.json()).session_token;
      break;
    }
  }
  expect(session, "aucune référence ajoutable au panier").toBeTruthy();

  const email = freshEmail();
  const checkout = await request.post(`${API}/cart/checkout/guest`, {
    headers: { "X-Cart-Session": session! },
    data: {
      email,
      first_name: "Camille",
      last_name: "Durand",
      phone: "0611223344",
      shipping: {
        line1: "8 rue des Verifications",
        postal_code: "13100",
        city: "Aix-en-Provence",
        country: "FR",
      },
      delivery_mode: "home",
      accept_terms: true,
    },
    timeout: 60_000,
  });
  expect(checkout.ok(), `checkout invité : ${checkout.status()}`).toBeTruthy();
  const order = await checkout.json();

  const auth = { Authorization: `Bearer ${order.access_token}` };

  // Le paiement doit d'abord être INITIÉ : la simulation capture une
  // transaction existante, elle n'en invente pas.
  const init = await request.post(
    `${API}/payment/init/${order.order_number}`,
    { headers: auth, timeout: 60_000 },
  );
  expect(init.ok(), `init paiement : ${init.status()}`).toBeTruthy();

  // Paiement simulé : l'API refuse cette route dès que le fournisseur de
  // paiement est réel, elle ne peut donc pas servir en production.
  const pay = await request.post(
    `${API}/payment/simulate/${order.order_number}`,
    { headers: auth },
  );
  if (pay.status() === 403) {
    // Environnement branché sur la vraie banque : impossible d'amener
    // une commande à « payée » sans passer une transaction. On saute —
    // SAUF en intégration continue, où un test silencieusement ignoré
    // serait pire que pas de test du tout.
    const why =
      "PAYMENT_PROVIDER=simulated est requis pour amener une commande " +
      "à l'état payé (l'API refuse la simulation en paiement réel).";
    if (process.env.CI) throw new Error(why);
    test.skip(true, why);
  }
  expect(pay.ok(), `simulation de paiement : ${pay.status()}`).toBeTruthy();
  expect((await pay.json()).order_status).toBe("paid");

  return { orderNumber: order.order_number, email };
}

async function patchStatus(
  request: APIRequestContext,
  admin: Session,
  orderNumber: string,
  status: string,
) {
  return request.patch(`${API}/admin/orders/${orderNumber}/status`, {
    headers: { Authorization: `Bearer ${admin.access}` },
    data: { status },
  });
}


test("machine à états : l'admin non plus ne peut pas sauter d'étape", async ({
  request,
}) => {
  const admin = await loginAdmin(request);
  const { orderNumber } = await seedPaidOrder(request);

  // Sauter l'expédition : le client recevrait « livrée » pour un colis
  // jamais parti.
  const saut = await patchStatus(request, admin, orderNumber, "delivered");
  expect(saut.status(), "paid -> delivered doit être refusé").toBe(400);

  // Statut inexistant : refusé aussi, sans 500.
  const inconnu = await patchStatus(request, admin, orderNumber, "livree");
  expect(inconnu.status()).toBe(422);

  // Retour arrière : une commande payée ne redevient pas « en attente ».
  const arriere = await patchStatus(request, admin, orderNumber, "pending_payment");
  expect(arriere.status()).toBe(400);

  // Et après ces trois refus, la commande n'a pas bougé.
  const apres = await request.get(`${API}/admin/orders/${orderNumber}`, {
    headers: { Authorization: `Bearer ${admin.access}` },
  });
  expect(apres.ok()).toBeTruthy();
  expect((await apres.json()).status).toBe("paid");
});


test("un remboursement sans montant est refusé", async ({ request }) => {
  // Le site ne rembourse pas par API : « remboursée » est une
  // DÉCLARATION. Sans montant elle n'est pas vérifiable — six mois plus
  // tard, face à un client qui affirme n'avoir rien reçu, un statut seul
  // ne prouve rien.
  const admin = await loginAdmin(request);
  const { orderNumber } = await seedPaidOrder(request);

  const sansMontant = await patchStatus(request, admin, orderNumber, "refunded");
  expect(sansMontant.status()).toBe(422);

  const trop = await request.patch(
    `${API}/admin/orders/${orderNumber}/status`,
    {
      headers: { Authorization: `Bearer ${admin.access}` },
      data: { status: "refunded", refund_cents: 99_999_999 },
    },
  );
  expect(trop.status(), "au-delà du total commande").toBe(422);

  // Après deux refus, la commande n'a pas bougé.
  const avant = await request.get(`${API}/admin/orders/${orderNumber}`, {
    headers: { Authorization: `Bearer ${admin.access}` },
  });
  const detail = await avant.json();
  expect(detail.status).toBe("paid");
  expect(detail.refunded).toBeNull();

  // Avec un montant valide : accepté, et le montant est conservé.
  const cents = Math.round(detail.total_ttc * 100);
  const ok = await request.patch(`${API}/admin/orders/${orderNumber}/status`, {
    headers: { Authorization: `Bearer ${admin.access}` },
    data: { status: "refunded", refund_cents: cents, cancel_reason: "Test e2e" },
  });
  expect(ok.ok(), `remboursement : ${ok.status()}`).toBeTruthy();
  const apres = await ok.json();
  expect(apres.status).toBe("refunded");
  expect(apres.refunded).toBeCloseTo(detail.total_ttc, 2);
  expect(apres.refunded_at).toBeTruthy();
  // Sans banque branchée (paiement simulé en CI), le site ne peut pas
  // exécuter le remboursement : il l'enregistre comme déclaration, et
  // le dit. C'est ce marquage qui distingue une preuve d'une parole.
  expect(apres.refund_mode).toBe("manual");
  expect(detail.refund_api_available).toBe(false);

  // Une facture émise ne se modifie pas : le remboursement doit produire
  // une facture d'avoir, seule pièce qui permet de régulariser la TVA
  // collectée sur la vente.
  expect(apres.credit_note_number, "aucun avoir attribué").toBeTruthy();
  const avoir = await request.get(
    `${API}/admin/orders/${orderNumber}/credit-note`,
    { headers: { Authorization: `Bearer ${admin.access}` } },
  );
  expect(avoir.ok(), `avoir : ${avoir.status()}`).toBeTruthy();
  expect(avoir.headers()["content-type"]).toContain("application/pdf");
  expect(avoir.headers()["content-disposition"]).toContain("avoir-AV-");
  expect((await avoir.body()).length).toBeGreaterThan(1000);
});


test("pas d'avoir sur une commande non remboursée", async ({ request }) => {
  // Un document hors série serait une pièce comptable fantôme.
  const admin = await loginAdmin(request);
  const { orderNumber } = await seedPaidOrder(request);

  const res = await request.get(
    `${API}/admin/orders/${orderNumber}/credit-note`,
    { headers: { Authorization: `Bearer ${admin.access}` } },
  );
  expect(res.status()).toBe(404);
});


test("l'espace admin est fermé aux clients", async ({ page, request }) => {
  const client = await login(request);

  // API : un jeton valide, mais pas admin.
  for (const url of [
    `${API}/admin/orders`,
    `${API}/admin/stats`,
    `${API}/admin/customers`,
  ]) {
    const res = await request.get(url, {
      headers: { Authorization: `Bearer ${client.access}` },
    });
    expect(res.status(), `${url} doit être fermé au client`).toBe(403);
  }

  // Interface : la session client ne doit pas ouvrir l'écran admin.
  await signIn(page, client, "/");
  await page.goto("/admin/commandes");
  await page.waitForURL(/\/admin\/login/, { timeout: 20_000 });

  // Sans session du tout non plus.
  await page.evaluate(() => localStorage.clear());
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/, { timeout: 20_000 });
});


test("commande : détail, changement de statut et trace d'audit", async ({
  page,
  request,
}) => {
  const admin = await loginAdmin(request);
  const { orderNumber, email } = await seedPaidOrder(request);

  await signIn(page, admin, "/admin/login");
  // Le tour de bienvenue s'ouvre en modale sur la première visite et
  // capture tous les clics. On le marque comme vu plutôt que de le
  // fermer : le test porte sur les commandes, pas sur l'accueil.
  await page.evaluate(() =>
    localStorage.setItem("tvp_admin_onboarding_v1", "done"),
  );
  await page.goto(`/admin/commandes/${orderNumber}`);

  // ── Le détail porte bien les informations client ────────────────
  await expect(page.getByText(orderNumber).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(email)).toBeVisible();

  // ── Transition autorisée : payée → envoyée au fournisseur ───────
  // Le <select> ne propose QUE les transitions permises : c'est le
  // garde-fou visible de la machine à états testée plus haut.
  const choix = page.locator("form select").first();
  await expect(choix).toBeVisible();
  await expect(choix.locator("option[value='delivered']")).toHaveCount(0);

  await choix.selectOption("sent_to_supplier");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();

  // L'écran reflète le nouvel état sans rechargement manuel.
  await expect(page.getByText(/fournisseur/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // ── L'audit garde la trace de QUI a changé QUOI ─────────────────
  // Sans elle, un statut fautif est indéfendable : impossible de savoir
  // s'il vient d'un admin, d'un job ou d'un bug.
  await page.getByRole("button", { name: /^Audit/ }).click();
  await expect(page.getByText("Changement de statut").first()).toBeVisible({
    timeout: 20_000,
  });
  // Qui : l'email de l'admin. Quoi : l'état de départ et d'arrivée.
  await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();
  await expect(page.getByText(/to: sent_to_supplier/).first()).toBeVisible();

  // ── Et l'API confirme, côté serveur ─────────────────────────────
  const detail = await request.get(`${API}/admin/orders/${orderNumber}`, {
    headers: { Authorization: `Bearer ${admin.access}` },
  });
  const corps = await detail.json();
  expect(corps.status).toBe("sent_to_supplier");
  expect(corps.allowed_transitions).toContain("shipped");
});
