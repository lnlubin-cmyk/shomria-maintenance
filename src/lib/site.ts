/**
 * The canonical public base URL, used to build absolute links in SMS messages.
 * Override in Vercel with NEXT_PUBLIC_SITE_URL if the domain changes.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.shomriya.com").replace(/\/+$/, "");

/** Absolute URL of a call's page (opens after login for a resident). */
export const faultUrl = (faultNumber: number) => `${SITE_URL}/faults/${faultNumber}`;
