import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import type { CommunityItem, CommunityMenuItem } from "@/lib/types";

export const COMMUNITY_BUCKET = "community";

/**
 * A freshly-signed URL for a document, minted per request. It is deliberately
 * NOT cached: a cached signed URL is served stale-while-revalidate, so an
 * infrequently-opened file (e.g. the weekly ידיעון) can be handed out after its
 * signature has already expired — which fails with Supabase "InvalidJWT / exp
 * claim" when opened. The view page is dynamic, so this runs once per visit and
 * the inline viewer + the "open" button share one fresh, valid URL.
 */
async function getSignedUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .createSignedUrl(path, 60 * 60 * 2); // 2 hours — ample to view/open
  return data?.signedUrl ?? null;
}

/**
 * The document items to show in the menu, split by section. An item shows only
 * when it's visible and has both a subject and a file — the exact condition the
 * menu must satisfy, in one place.
 */
export const getMenuDocs = cache(async (): Promise<{
  community: CommunityMenuItem[];
  info: CommunityMenuItem[];
  torah: CommunityMenuItem[];
}> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_items")
    .select("id, subject, file_path, section")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");

  const rows = (data ?? []).filter((r) => r.subject.trim() !== "" && !!r.file_path);
  const inSection = (s: string) => rows.filter((r) => r.section === s).map((r) => ({ id: r.id, subject: r.subject }));
  return {
    // Legacy rows default to 'community', so anything not info/torah counts as community.
    community: rows.filter((r) => r.section !== "info" && r.section !== "torah").map((r) => ({ id: r.id, subject: r.subject })),
    info: inSection("info"),
    torah: inSection("torah"),
  };
});

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

  const url = await getSignedUrl(item.file_path);
  if (!url) return null;

  return { item, url };
}
