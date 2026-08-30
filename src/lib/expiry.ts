/**
 * Expiration helpers for admin-added display items. An item shows while today's
 * date (in Israel time) is on or before its expiration date; a null date means
 * it never expires. Dates are compared as "YYYY-MM-DD" strings, which sort
 * correctly, so no time-of-day / timezone drift.
 */

/** Today's date in Israel, as "YYYY-MM-DD". */
export function israelToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/** True when the item is still active (no expiry, or today <= expiry). */
export function notExpired(expiresAt: string | null | undefined, today: string = israelToday()): boolean {
  return !expiresAt || expiresAt >= today;
}
