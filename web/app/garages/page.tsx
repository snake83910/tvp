import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * La recherche de garages a fusionné avec la page montage. On redirige en
 * conservant la recherche (l'ancien paramètre `cp` devient `q`).
 */
export default async function GaragesRedirect(
  props: {
    searchParams: Promise<{ q?: string; cp?: string; radius?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const q = (searchParams.q || searchParams.cp || "").trim();
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (searchParams.radius) p.set("radius", searchParams.radius);
  const qs = p.toString();
  redirect(qs ? `/montage-pneu?${qs}` : "/montage-pneu");
}
