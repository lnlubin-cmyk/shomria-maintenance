import { createAdminClient } from "@/lib/supabase/server";
import type { CommunityItem, CommunityMenuItem } from "@/lib/types";

export const COMMUNITY_BUCKET = "community";

/**
 * The document items to show in the menu, split by section. An item shows only
 * when it's visible and has both a subject and a file — the exact condition the
 * menu must satisfy, in one place.
 */
export async function getMenuDocs(): Promise<{
  community: CommunityMenuItem[];
  info: CommunityMenuItem[];
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_items")
    .select("id, subject, file_path, section")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");

  const rows = (data ?? []).filter((r) => r.subject.trim() !== "" && !!r.file_path);
  return {
    community: rows.filter((r) => r.section !== "info").map((r) => ({ id: r.id, subject: r.subject })),
    info: rows.filter((r) => r.section === "info").map((r) => ({ id: r.id, subject: r.subject })),
  };
}

/** All items, for the admin management tab (includes hidden/incomplete ones). */
export async function getAllCommunityItems(): Promise<CommunityItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_items")
    .select("*")
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as CommunityItem[];
}

/**
 * A single item plus a short-lived signed URL to its PDF, for the view page.
 * Returns null if the item is missing, hidden, or has no file — residents may
 * only reach complete, visible items.
 */
export async function getCommunityItemForView(
  id: string
): Promise<{ item: CommunityItem; url: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("community_items").select("*").eq("id", id).maybeSingle();
  const item = data as CommunityItem | null;
  if (!item || !item.is_visible || !item.file_path) return null;

  const { data: signed } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .createSignedUrl(item.file_path, 60 * 60); // 1 hour
  if (!signed?.signedUrl) return null;

  return { item, url: signed.signedUrl };
}
