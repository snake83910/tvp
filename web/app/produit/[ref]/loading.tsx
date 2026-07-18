import { SiteHeader } from "@/components/SiteHeader";
import { Skeleton } from "@/components/Skeleton";

/** Squelette de la fiche produit pendant le fetch Maxityre côté serveur. */
export default function ProductLoading() {
  return (
    <>
      <SiteHeader />
      <main
        className="mx-auto max-w-6xl px-6 py-10"
        aria-busy="true"
        aria-label="Chargement de la fiche produit"
      >
        <Skeleton className="h-4 w-40" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            <Skeleton className="h-96 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    </>
  );
}
