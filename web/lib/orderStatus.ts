export const STATUS_LABEL: Record<string, string> = {
  cart: "Panier",
  pending_payment: "En attente de paiement",
  paid: "Payée",
  sent_to_supplier: "Transmise au fournisseur",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

export const STATUS_COLOR: Record<string, string> = {
  cart: "bg-paper-dim text-ink-soft",
  pending_payment: "bg-paper-dim text-ink-soft",
  paid: "bg-ok/10 text-ok",
  sent_to_supplier: "bg-ok/10 text-ok",
  shipped: "bg-ok/10 text-ok",
  delivered: "bg-ok/10 text-ok",
  cancelled: "bg-signal-light text-signal-dark",
  refunded: "bg-signal-light text-signal-dark",
};
