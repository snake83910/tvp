/**
 * Génère un slug SEO depuis brand/model. Pas d'accents, espaces -> tirets.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * URL canonique d'une fiche produit pour SEO.
 * Format : /pneus/<w>-<h>-r<d>/<brand>-<model>-<ref>
 *
 * Ex: /pneus/205-55-r16/michelin-primacy-4-PNREF12345
 */
export function productUrl(args: {
  ref: string;
  brand: string;
  model: string;
  width: number;
  ratio: number;
  diameter: number;
}): string {
  const slug = `${slugify(args.brand)}-${slugify(args.model)}-${encodeURIComponent(args.ref)}`;
  return `/pneus/${args.width}-${args.ratio}-r${args.diameter}/${slug}`;
}

/**
 * Parse l'URL et extrait ref + dimensions. Renvoie null si invalide.
 */
export function parseProductSlug(
  dim: string,
  slug: string,
): { ref: string; width: number; ratio: number; diameter: number } | null {
  const m = dim.match(/^(\d+)-(\d+)-r(\d+)$/i);
  if (!m) return null;
  // ref = dernier segment du slug
  const parts = slug.split("-");
  const ref = decodeURIComponent(parts[parts.length - 1] ?? "");
  if (!ref) return null;
  return {
    ref,
    width: Number(m[1]),
    ratio: Number(m[2]),
    diameter: Number(m[3]),
  };
}
