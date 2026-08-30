import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { notExpired, israelToday } from "@/lib/expiry";
import type { CommunityItem, CommunityMenuItem } from "@/lib/types";

export const COMMUNITY_BUCKET = "community";

// The signed URL is valid for 30 days but cached (reused) for only an hour. The
// long validity is the fix for the old "InvalidJWT / exp claim" bug: even when
// the cache serves a stale entry, a 30-day signature is effectively never
// expired (it would take a document nobody opened for a month, and a refresh
// then re-mints it). Reusing the same URL for an hour lets the browser cache the
// file instead of re-downloading it on every open. Uploading a new file changes
// file_path → a new cache key, so a replaced document is never served stale.
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 days
const getSignedUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    return data?.signedUrl ?? null;
  },
  ["community-doc-signed-url-30d"],
  { revalidate: 60 * 60 } // reuse the same URL for an hour
);

// A signed URL that serves the file with Content-Disposition: attachment, so the
// "הורד קובץ" button hands the file to the device (triggering the phone's own
// "open with" chooser + native viewer) instead of rendering it in the browser.
const getSignedDownloadUrl = unstable_cache(
  async (path: string, filename: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(COMMUNITY_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL, { download: filename || true });
    return data?.signedUrl ?? null;
  },
  ["community-doc-download-url-30d"],
  { revalidate: 60 * 60 }
);

/**
 * The menu items to show, split by section. An item shows only when it's visible,
 * has a subject, AND has content — a file (file mode) or non-empty body (text
 * mode) — the exact condition the menu must satisfy, in one place.
 */
export const getMenuDocs = cache(async (): Promise<{
  community: CommunityMenuItem[];
  info: CommunityMenuItem[];
  torah: CommunityMenuItem[];
}> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_items")
    .select("id, subject, file_path, section, mode, body, icon, description, expires_at")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");

  const today = israelToday();
  const rows = (data ?? []).filter(
    (r) =>
      r.subject.trim() !== "" &&
      notExpired(r.expires_at, today) &&
      (r.mode === "text" ? (r.body ?? "").trim() !== "" : !!r.file_path)
  );
  const toMenu = (r: (typeof rows)[number]): CommunityMenuItem => ({
    id: r.id,
    subject: r.subject,
    icon: r.icon ?? "",
    description: r.description ?? "",
  });
  const inSection = (s: string) => rows.filter((r) => r.section === s).map(toMenu);
  return {
    // Legacy rows default to 'community', so anything not info/torah counts as community.
    community: rows.filter((r) => r.section !== "info" && r.section !== "torah").map(toMenu),
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
 * A single item for the view page, plus a fresh signed URL when it's a file
 * item (`url` is null for a text item). Returns null if the item is missing,
 * hidden, or has no content — residents may only reach complete, visible items.
 */
export async function getCommunityItemForView(
  id: string
): Promise<{ item: CommunityItem; url: string | null; downloadUrl: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("community_items").select("*").eq("id", id).maybeSingle();
  const item = data as CommunityItem | null;
  if (!item || !item.is_visible || !notExpired(item.expires_at)) return null;

  if (item.mode === "text") {
    return item.body.trim() !== "" ? { item, url: null, downloadUrl: null } : null;
  }

  if (!item.file_path) return null;
  const url = await getSignedUrl(item.file_path);
  if (!url) return null;
  const downloadUrl = await getSignedDownloadUrl(item.file_path, item.file_name ?? "");
  return { item, url, downloadUrl };
}
