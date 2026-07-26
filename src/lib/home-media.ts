import { createAdminClient } from "@/lib/supabase/server";
import type { HomeMedia, HomeMediaItem } from "@/lib/types";

export const HOME_MEDIA_BUCKET = "home-media";

function publicUrl(admin: ReturnType<typeof createAdminClient>, path: string): string {
  return admin.storage.from(HOME_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Active media for the home-page carousel, in playback order. */
export async function getActiveHomeMedia(): Promise<HomeMediaItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("home_media")
    .select("id, kind, file_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  return (data ?? []).map((m) => ({
    id: m.id,
    kind: m.kind as "image" | "video",
    url: publicUrl(admin, m.file_path),
  }));
}

/** All media (active + disabled) for the admin tab, with preview URLs. */
export async function getAllHomeMedia(): Promise<(HomeMedia & { url: string })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("home_media")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return (data ?? []).map((m) => ({ ...(m as HomeMedia), url: publicUrl(admin, m.file_path) }));
}
