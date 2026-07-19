/**
 * Residents log in by email, so the residents table stores one canonical form
 * and lookup at sign-in is an exact match. Trim and lowercase — "Yossi@GMail.com "
 * and "yossi@gmail.com" are the same login. The DB enforces the same shape via
 * the residents_email_format / residents_email_normalized constraints.
 */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  if (!email) return null;
  // Deliberately permissive: exactly one @, non-empty local part, and a dotted
  // domain. Stricter regexes reject valid addresses; the real proof is that the
  // OTP email arrives.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
