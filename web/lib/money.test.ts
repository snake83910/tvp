import { describe, it, expect } from "vitest";
import { formatEuro } from "@/lib/money";

// Intl utilise des espaces insécables (U+202F pour le groupement,
// U+00A0 avant le symbole €). On normalise pour des assertions lisibles.
const norm = (s: string) => s.replace(/ /g, " ").replace(/ /g, " ");

describe("formatEuro", () => {
  it("formate avec deux décimales et virgule française", () => {
    expect(norm(formatEuro(1234.5))).toBe("1 234,50 €");
  });

  it("formate zéro", () => {
    expect(norm(formatEuro(0))).toBe("0,00 €");
  });

  it("arrondit à deux décimales", () => {
    expect(norm(formatEuro(9.999))).toBe("10,00 €");
  });

  it("gère les montants négatifs (remboursement)", () => {
    expect(norm(formatEuro(-49.9))).toBe("-49,90 €");
  });
});
