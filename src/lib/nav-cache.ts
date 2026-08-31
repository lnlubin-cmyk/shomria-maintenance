import { revalidateTag } from "next/cache";

/**
 * Shared cache tag for the navigation / home-menu data. The menu lookups
 * (community items, info panels, prayer schedules, moments, events) are
 * cross-request cached with this tag so they aren't re-queried on every page
 * navigation. Any admin action that changes what the menu shows must call
 * `revalidateNav()` so the change appears immediately instead of waiting for the
 * cache's safety-net revalidation.
 */
export const NAV_TAG = "nav-menu";

/** Cross-request cache options for a nav lookup (instant refresh via NAV_TAG). */
export const NAV_CACHE: { tags: string[]; revalidate: number } = { tags: [NAV_TAG], revalidate: 600 };

/** Drop the cached nav data so the next request rebuilds it. */
export function revalidateNav() {
  revalidateTag(NAV_TAG);
}
