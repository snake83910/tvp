import { GaragePicker } from "@/components/GaragePicker";
import type { GarageNearby } from "@/lib/api";
import { formatEuro } from "@/lib/money";

type DeliveryMode = "home" | "partner_garage";

/** Choix du mode de livraison : domicile ou montage en garage partenaire.
 *  Sélectionner « domicile » remet à zéro le garage choisi. */
export function DeliveryModeSelector({
  mode,
  onSelectHome,
  onSelectPartner,
  shippingHt,
  isFreeShipping,
  selectedGarage,
  onSelectGarage,
}: {
  mode: DeliveryMode;
  onSelectHome: () => void;
  onSelectPartner: () => void;
  shippingHt: number;
  isFreeShipping: boolean;
  selectedGarage: GarageNearby | null;
  onSelectGarage: (g: GarageNearby | null) => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSelectHome}
        className={`flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition ${
          mode === "home"
            ? "border-signal bg-signal-light"
            : "border-line hover:border-signal/50"
        }`}
      >
        <div>
          <p className="font-semibold text-ink">
            Livraison à domicile
          </p>
          <p className="text-sm text-ink-muted">
            {isFreeShipping
              ? "Gratuite (toutes les références à ≥ 2 pneus)"
              : `${formatEuro(shippingHt)} HT — gratuite si chaque référence est à 2 pneus minimum`}
          </p>
        </div>
        {mode === "home" && (
          <span className="text-sm font-bold text-signal">Sélectionné</span>
        )}
      </button>

      <button
        type="button"
        onClick={onSelectPartner}
        className={`flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition ${
          mode === "partner_garage"
            ? "border-signal bg-signal-light"
            : "border-line hover:border-signal/50"
        }`}
      >
        <div>
          <p className="font-semibold text-ink">
            Montage chez un garage partenaire
          </p>
          <p className="text-sm text-ink-muted">
            Vos pneus sont livrés au garage, prêt à les monter.
            Montage réglé sur place.
          </p>
        </div>
        {mode === "partner_garage" && (
          <span className="text-sm font-bold text-signal">Sélectionné</span>
        )}
      </button>

      {mode === "partner_garage" && (
        <GaragePicker
          selectedId={selectedGarage?.id ?? null}
          onSelect={onSelectGarage}
        />
      )}
    </div>
  );
}
