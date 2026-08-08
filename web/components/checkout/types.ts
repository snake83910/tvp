/** Types partagés du tunnel de commande (page checkout + composants). */

export interface PriceChange {
  supplier_ref: string;
  label: string;
  old_ttc: number;
  new_ttc: number;
}

export interface AddressDraft {
  label: string;
  line1: string;
  line2: string;
  postal_code: string;
  city: string;
  country: string;
}
