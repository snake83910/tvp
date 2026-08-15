import { describe, it, expect } from "vitest";
import {
  slugify,
  productUrl,
  dimensionUrl,
  formatDimension,
  parseDimSlug,
  parseProductSlug,
  productUrlOrNull,
} from "@/lib/slug";

describe("slugify", () => {
  it("retire les accents et met en minuscules", () => {
    expect(slugify("Michelin Été")).toBe("michelin-ete");
  });

  it("remplace les caractères non alphanumériques par des tirets", () => {
    expect(slugify("Pilot Sport 4S")).toBe("pilot-sport-4s");
  });

  it("supprime les tirets en début et fin", () => {
    expect(slugify("  Primacy  ")).toBe("primacy");
    expect(slugify("--x--")).toBe("x");
  });

  it("effondre les séparateurs multiples en un seul tiret", () => {
    expect(slugify("a / b // c")).toBe("a-b-c");
  });
});

describe("productUrl", () => {
  const base = {
    ref: "PNREF12345",
    brand: "Michelin",
    model: "Primacy 4",
    width: 205,
    ratio: 55,
    diameter: 16,
  };

  it("construit l'URL canonique auto sans paramètre de catégorie", () => {
    expect(productUrl(base)).toBe("/pneus/205-55-r16/michelin-primacy-4-PNREF12345");
  });

  it("omet le paramètre t pour la catégorie auto", () => {
    expect(productUrl({ ...base, category: "auto" })).not.toContain("?t=");
  });

  it("ajoute le paramètre t pour une catégorie non-auto", () => {
    expect(productUrl({ ...base, category: "camion" })).toContain("?t=camion");
  });

  it("encode la référence pour rester URL-safe", () => {
    const url = productUrl({ ...base, ref: "REF/12 34" });
    expect(url).toContain("REF%2F12%2034");
  });
});

describe("dimensionUrl", () => {
  it("formate le segment dimension", () => {
    expect(dimensionUrl(205, 55, 16)).toBe("/pneus/205-55-r16");
  });
});

describe("formatDimension", () => {
  it("formate pour l'affichage", () => {
    expect(formatDimension(205, 55, 16)).toBe("205/55 R16");
  });
});

describe("parseDimSlug", () => {
  it("parse un segment valide", () => {
    expect(parseDimSlug("205-55-r16")).toEqual({ width: 205, ratio: 55, diameter: 16 });
  });

  it("accepte un diamètre décimal (poids lourd)", () => {
    expect(parseDimSlug("315-70-r22.5")).toEqual({ width: 315, ratio: 70, diameter: 22.5 });
  });

  it("est insensible à la casse du R", () => {
    expect(parseDimSlug("205-55-R16")).toEqual({ width: 205, ratio: 55, diameter: 16 });
  });

  it("renvoie null sur un format invalide", () => {
    expect(parseDimSlug("nimportequoi")).toBeNull();
    expect(parseDimSlug("205/55/16")).toBeNull();
    expect(parseDimSlug("205-55-16")).toBeNull();
  });
});

describe("parseProductSlug", () => {
  it("extrait ref + dimensions", () => {
    expect(parseProductSlug("205-55-r16", "michelin-primacy-4-PNREF12345")).toEqual({
      ref: "PNREF12345",
      width: 205,
      ratio: 55,
      diameter: 16,
    });
  });

  it("décode la référence encodée", () => {
    const r = parseProductSlug("205-55-r16", "marque-modele-REF%2F12");
    expect(r?.ref).toBe("REF/12");
  });

  it("renvoie null si la dimension est invalide", () => {
    expect(parseProductSlug("bad", "marque-modele-REF")).toBeNull();
  });

  it("renvoie null si la ref est vide", () => {
    expect(parseProductSlug("205-55-r16", "")).toBeNull();
  });
});

describe("productUrlOrNull", () => {
  const base = {
    supplier_ref: "REF123",
    brand: "Michelin",
    model: "Primacy 4",
    width: 205 as number | null,
    aspect_ratio: 55 as number | null,
    diameter: 16 as number | null,
  };

  it("rend l'URL canonique quand la dimension est connue", () => {
    expect(productUrlOrNull(base)).toBe("/pneus/205-55-r16/michelin-primacy-4-REF123");
  });

  it("garde la famille de véhicule hors auto", () => {
    expect(productUrlOrNull({ ...base, category: "camion" })).toContain("?t=camion");
  });

  // Le fournisseur renvoie null plutôt que d'inventer une dimension qu'il
  // n'a pas su lire. Sans URL, l'appelant doit cesser de proposer la
  // fiche : le catalogue s'interroge PAR dimension, le lien serait mort.
  it.each(["width", "aspect_ratio", "diameter"] as const)(
    "renvoie null si %s manque",
    (champ) => {
      expect(productUrlOrNull({ ...base, [champ]: null })).toBeNull();
    },
  );
});
