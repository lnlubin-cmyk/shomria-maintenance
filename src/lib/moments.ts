import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveMoment } from "@/lib/moments-embed";
import { notExpired, israelToday } from "@/lib/expiry";
import { NAV_CACHE } from "@/lib/nav-cache";
import type { Moment, MomentView } from "@/lib/types";

/** Visible moments, resolved for the public gallery (in display order). */
export async function getVisibleMoments(): Promise<MomentView[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_moments")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");
  const today = israelToday();
  return ((data ?? []) as Moment[]).filter((m) => notExpired(m.expires_at, today)).map(resolveMoment);
}

/** All moments (visible + hidden) for the admin tab, in display order. */
export async function getAllMoments(): Promise<Moment[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_moments")
    .select("*")
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as Moment[];
}

/** Whether any visible, non-expired moment exists — for the home-page tile. */
export const momentsExist = unstable_cache(
  async (): Promise<boolean> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("community_moments")
      .select("expires_at")
      .eq("is_visible", true);
    const today = israelToday();
    return (data ?? []).some((m) => notExpired(m.expires_at, today));
  },
  ["nav-moments-exist"],
  NAV_CACHE
);
