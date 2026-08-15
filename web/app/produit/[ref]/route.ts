import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { productUrl } from "@/lib/slug";

export const dynamic = "force-dynamic";

/**
 * Ancienne URL de fiche produit — devenue une simple redirection.
 *
 * Le site a longtemps eu DEUX fiches produit pour le même pneu :
 * `/produit/<ref>?w=&h=&d=` et `/pneus/<dim>/<marque-modele-ref>`. Deux
 * gabarits à maintenir en parallèle — ils avaient d'ailleurs déjà
 * divergé : étiquette EPREL, badges, fil d'Ariane et descriptif
 * fournisseur n'existaient que sur le second — et surtout deux URL
 * indexables servant le même contenu, que Google arbitre à notre place.
 *
 * `/pneus/...` est désormais la seule fiche. Cette route ne rend plus
 * rien : elle résout la référence et redirige, ce qui garde vivants les
 * liens externes et les favoris tout en consolidant le référencement sur
 * une seule adresse.
 *
 * Route Handler et non Page : `permanentRedirect()` dans un composant
 * serveur part APRÈS le début du streaming, et Next se rabat alors sur un
 * `<meta http-equiv="refresh">` — une redirection molle en 200, que les
 * moteurs traitent moins bien qu'un vrai 308. Ici, on maîtrise le statut.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ ref: string }> },
) {
  const { ref: rawRef } = await ctx.params;
  const ref = decodeURIComponent(rawRef);
  const q = request.nextUrl.searchParams;
  const [w, h, d, t] = [q.get("w"), q.get("h"), q.get("d"), q.get("t")];

  // Sans dimensions, la référence est irrésolvable côté fournisseur
  // (l'API catalogue les exige) : 404 franc plutôt qu'un cul-de-sac.
  if (!w || !h || !d) return notFoundResponse(request);

  try {
    const tyre = await api.getProduct(
      ref, Number(w), Number(h), Number(d), undefined, t ?? undefined,
    );
    const target = productUrl({
      ref: tyre.supplier_ref,
      brand: tyre.brand,
      model: tyre.model,
      // Dimensions normalisées par l'API, préférées à celles de l'URL
      // qui peuvent être mal formées.
      width: tyre.width ?? Number(w),
      ratio: tyre.aspect_ratio ?? Number(h),
      diameter: tyre.diameter ?? Number(d),
      category: tyre.category,
    });
    return NextResponse.redirect(new URL(target, request.nextUrl.origin), 308);
  } catch {
    return notFoundResponse(request);
  }
}

/** 404 minimal mais présentable : un Route Handler ne peut pas rendre la
 *  page `not-found` de l'application. */
function notFoundResponse(request: NextRequest) {
  const home = new URL("/recherche", request.nextUrl.origin).toString();
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex">` +
      `<title>Pneu introuvable — tousvospneus.com</title></head>` +
      `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
      `font-family:Arial,Helvetica,sans-serif;background:#f6f6f4;color:#17181a;text-align:center">` +
      `<div><h1 style="font-size:24px;font-weight:900;margin:0 0 12px">Ce pneu n'est plus disponible</h1>` +
      `<p style="margin:0 0 24px;color:#6b6f76">La référence n'existe plus chez notre fournisseur.</p>` +
      `<a href="${home}" style="display:inline-block;padding:12px 24px;background:#D8232A;color:#fff;` +
      `text-decoration:none;border-radius:999px;font-weight:700">Rechercher un pneu</a></div></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
