import { createAdminClient } from "@/lib/supabase/server";
import type { ActiveCampaign, Campaign } from "@/lib/types";

export const CAMPAIGN_BUCKET = "campaigns";

function publicUrl(admin: ReturnType<typeof createAdminClient>, path: string): string {
  return admin.storage.from(CAMPAIGN_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The single active campaign (with an image), for the home-page modal. */
export async function getActiveCampaign(): Promise<ActiveCampaign | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select("id, title, file_path, link_url, frequency")
    .eq("is_active", true)
    .not("file_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.file_path) return null;
  return {
    id: data.id,
    title: data.title ?? "",
    imageUrl: publicUrl(admin, data.file_path),
    linkUrl: data.link_url ?? null,
    frequency: data.frequency === "daily" ? "daily" : "once",
  };
}

/** All campaigns for the admin tab, each with a preview URL. */
export async function getAllCampaigns(): Promise<(Campaign & { previewUrl: string })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  return (data ?? []).map((c) => {
    const row = c as Campaign;
    return { ...row, previewUrl: row.file_path ? publicUrl(admin, row.file_path) : "" };
  });
}
