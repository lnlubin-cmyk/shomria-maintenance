/**
 * Israeli phone numbers arrive in many shapes — 050-123-4567, 0501234567,
 * +972501234567, 972-50-1234567. The residents table stores one canonical
 * E.164 form so phone lookup at sign-in is an exact match.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let rest: string;

  if (digits.startsWith("+972")) {
    rest = digits.slice(4);
  } else if (digits.startsWith("972")) {
    rest = digits.slice(3);
  } else if (digits.startsWith("0")) {
    rest = digits.slice(1);
  } else {
    rest = digits;
  }

  rest = rest.replace(/\D/g, "");

  // Israeli subscriber numbers are 8 digits (mobile 5X, landline 2/3/4/8/9).
  if (rest.length !== 9 && rest.length !== 8) return null;

  return `+972${rest}`;
}

/** Display form: +972501234567 -> 050-123-4567 */
export function formatIsraeliPhone(e164: string): string {
  const m = e164.match(/^\+972(\d{1,2})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `0${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * The internal auth-account email for a phone-based (email-less) resident.
 * Deterministic from the phone, never delivered anywhere — Supabase just needs
 * a unique email as the account identifier. Login by phone recomputes it, so no
 * lookup and no way to enumerate real emails.
 */
export function phoneAccountEmail(e164: string): string {
  return `${e164.replace(/\D/g, "")}@sms.shomria.local`;
}

/** True if the input looks like an email address (vs a phone). */
export function looksLikeEmail(input: string): boolean {
  return input.includes("@");
}
