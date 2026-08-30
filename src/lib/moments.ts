import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveMoment } from "@/lib/moments-embed";
import { notExpired, israelToday } from "@/lib/expiry";
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
export const momentsExist = cache(async (): Promise<boolean> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_moments")
    .select("expires_at")
    .eq("is_visible", true);
  const today = israelToday();
  return (data ?? []).some((m) => notExpired(m.expires_at, today));
});
