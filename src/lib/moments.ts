import { createAdminClient } from "@/lib/supabase/server";
import { resolveMoment } from "@/lib/moments-embed";
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
  return ((data ?? []) as Moment[]).map(resolveMoment);
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

/** Whether any visible moment exists — for showing the home-page tile. */
export async function momentsExist(): Promise<boolean> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("community_moments")
    .select("id", { count: "exact", head: true })
    .eq("is_visible", true);
  return (count ?? 0) > 0;
}
