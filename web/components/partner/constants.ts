export const DAYS: { key: string; label: string }[] = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
];

export const PAYMENT_METHODS: { key: string; label: string }[] = [
  { key: "cb", label: "Carte bancaire" },
  { key: "cheque", label: "Chèque" },
  { key: "especes", label: "Espèces" },
  { key: "virement", label: "Virement" },
];

export const VEHICLE_TYPES: { key: string; label: string }[] = [
  { key: "voiture", label: "Voiture" },
  { key: "suv", label: "4×4 / SUV" },
  { key: "utilitaire", label: "Camionnette / Utilitaire" },
  { key: "moto", label: "Moto" },
  { key: "runflat", label: "Runflat" },
];

export function vehicleLabel(key: string): string {
  return VEHICLE_TYPES.find((v) => v.key === key)?.label ?? key;
}

export function paymentLabel(key: string): string {
  return PAYMENT_METHODS.find((p) => p.key === key)?.label ?? key;
}
