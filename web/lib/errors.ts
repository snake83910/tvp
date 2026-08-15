/**
 * Erreurs d'API : un seul type, un `code` stable.
 *
 * Le backend renvoie systématiquement `{code, message, details, detail}`.
 * Le `code` est le contrat — c'est lui qu'on teste. Le `message` est
 * destiné à l'affichage et peut être reformulé ou traduit à tout moment :
 * brancher du comportement dessus (comme le faisait
 * `if (/compte existe déjà/i.test(msg))`) casse au premier changement de
 * formulation.
 */

/** Codes utilisés côté front. La liste côté serveur est plus longue —
 *  on ne déclare ici que ceux sur lesquels une UI réagit vraiment. */
export const ErrorCode = {
  emailTaken: "email_taken",
  stockInsufficient: "stock_insufficient",
  cartEmpty: "cart_empty",
  validationError: "validation_error",
  // Rendez-vous de montage
  slotTaken: "slot_taken",
  slotTooEarly: "slot_too_early",
  slotNotOffered: "slot_not_offered",
  appointmentsDisabled: "appointments_disabled",
  appointmentLocked: "appointment_locked",
  // Espace partenaire
  garageFieldsLocked: "garage_fields_locked",
  noGarageForAccount: "no_garage_for_account",
  // Services externes
  supplierUnavailable: "supplier_unavailable",
  supplierUnconfigured: "supplier_unconfigured",
  plateLookupUnavailable: "plate_lookup_unavailable",
} as const;

export type ApiErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode] | string;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** `true` si l'erreur porte l'un des codes donnés. */
  is(...codes: ApiErrorCode[]): boolean {
    return codes.includes(this.code);
  }

  /** Champ fautif d'une 422, pour surligner le bon input. */
  get invalidFields(): string[] {
    const fields = this.details.fields;
    if (!Array.isArray(fields)) return [];
    return fields
      .map((f) => (f as { field?: string }).field)
      .filter((f): f is string => Boolean(f));
  }
}

/** Construit une ApiError depuis une réponse non-ok.
 *
 *  Tolérant aux réponses hors format : une 502 renvoyée par le proxy
 *  n'est pas du JSON, et ne doit pas produire une exception de parsing
 *  par-dessus l'erreur d'origine. */
export async function apiError(res: Response): Promise<ApiError> {
  let code = `http_${res.status}`;
  let message = `Erreur ${res.status}`;
  let details: Record<string, unknown> = {};
  try {
    const body = await res.json();
    if (typeof body?.code === "string") code = body.code;
    if (typeof body?.message === "string") message = body.message;
    else if (typeof body?.detail === "string") message = body.detail;
    if (body?.details && typeof body.details === "object") details = body.details;
  } catch {
    /* réponse non-JSON : on garde le repli sur le statut */
  }
  return new ApiError(code, message, res.status, details);
}

/** Message affichable pour une erreur quelconque (API, réseau, bug). */
export function errorMessage(e: unknown, fallback = "Une erreur est survenue"): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/** Code d'une erreur si c'en est une de l'API, sinon null. */
export function errorCode(e: unknown): ApiErrorCode | null {
  return e instanceof ApiError ? e.code : null;
}
