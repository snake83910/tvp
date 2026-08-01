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
 * Format : /pneus/<w>-<h>-r<d>/<brand>-<model>-<ref>[?t=<categorie>]
 *
 * Ex: /pneus/205-55-r16/michelin-primacy-4-PNREF12345
 *     /pneus/315-70-r22.5/torque-t1000-REF987?t=camion
 */
export function productUrl(args: {
  ref: string;
  brand: string;
  model: string;
  width: number;
  ratio: number;
  diameter: number;
  category?: string;
}): string {
  const slug = `${slugify(args.brand)}-${slugify(args.model)}-${encodeURIComponent(args.ref)}`;
  const base = `/pneus/${args.width}-${args.ratio}-r${args.diameter}/${slug}`;
  return args.category && args.category !== "auto"
    ? `${base}?t=${args.category}`
    : base;
}

/**
 * URL propre d'une page d'atterrissage dimension.
 * Ex: dimensionUrl(205, 55, 16) -> "/pneus/205-55-r16"
 */
export function dimensionUrl(
  width: number,
  ratio: number,
  diameter: number,
): string {
  return `/pneus/${width}-${ratio}-r${diameter}`;
}

/** Formatte une dimension pour l'affichage : "205/55 R16". */
export function formatDimension(
  width: number,
  ratio: number,
  diameter: number,
): string {
  return `${width}/${ratio} R${diameter}`;
}

/**
 * Parse le segment dimension d'URL (ex. "205-55-r16") en dimensions.
 * Renvoie null si le format est invalide.
 */
export function parseDimSlug(
  dim: string,
): { width: number; ratio: number; diameter: number } | null {
  const m = dim.match(/^(\d+)-(\d+)-r(\d+(?:\.\d)?)$/i);
  if (!m) return null;
  return {
    width: Number(m[1]),
    ratio: Number(m[2]),
    diameter: Number(m[3]),
  };
}

/**
 * Parse l'URL et extrait ref + dimensions. Renvoie null si invalide.
 * Le diamètre peut être décimal (poids lourd : r22.5).
 */
export function parseProductSlug(
  dim: string,
  slug: string,
): { ref: string; width: number; ratio: number; diameter: number } | null {
  const m = dim.match(/^(\d+)-(\d+)-r(\d+(?:\.\d)?)$/i);
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
