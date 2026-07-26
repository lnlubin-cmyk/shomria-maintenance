import { createAdminClient } from "@/lib/supabase/server";
import type { HomeMedia, HomeMediaItem } from "@/lib/types";

export const HOME_MEDIA_BUCKET = "home-media";

function publicUrl(admin: ReturnType<typeof createAdminClient>, path: string): string {
  return admin.storage.from(HOME_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** YouTube thumbnail for an admin-side preview. */
export function youtubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/** Active media for the home-page carousel, in playback order. */
export async function getActiveHomeMedia(): Promise<HomeMediaItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("home_media")
    .select("id, kind, file_path, youtube_id")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  return (data ?? []).map((m) => {
    if (m.kind === "youtube") {
      return { id: m.id, kind: "youtube" as const, youtubeId: m.youtube_id ?? undefined };
    }
    return {
      id: m.id,
      kind: m.kind as "image" | "video",
      url: m.file_path ? publicUrl(admin, m.file_path) : undefined,
    };
  });
}

/** All media (active + disabled) for the admin tab, each with a preview URL. */
export async function getAllHomeMedia(): Promise<(HomeMedia & { previewUrl: string })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("home_media")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return (data ?? []).map((m) => {
    const row = m as HomeMedia;
    const previewUrl =
      row.kind === "youtube"
        ? youtubeThumb(row.youtube_id ?? "")
        : row.file_path
          ? publicUrl(admin, row.file_path)
          : "";
    return { ...row, previewUrl };
  });
}
