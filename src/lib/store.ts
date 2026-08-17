import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { docKind } from "@/lib/doc-files";
import type { StoreInfo } from "@/lib/types";

/** The route for the מכולת info page. */
export const STORE_HREF = "/grocery";

const DEFAULT: StoreInfo = { menu_label: "מכולת", mode: "text", body: "", file_path: null, file_name: null };

/**
 * The single מכולת record. Wrapped in React `cache` so the menu (header) and the
 * home tile share one lookup per request. Falls back to defaults if the row is
 * somehow missing.
 */
export const getStoreInfo = cache(async (): Promise<StoreInfo> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("store_info")
    .select("menu_label, mode, body, file_path, file_name")
    .eq("id", true)
    .maybeSingle();
  return (data as StoreInfo | null) ?? DEFAULT;
});

/** True once there's something to show for the active mode. */
export function isStoreConfigured(s: StoreInfo): boolean {
  return s.mode === "pdf" ? !!s.file_path : s.body.trim() !== "";
}

// Signed URL for the PDF, cached for an hour so repeat views reuse it (the URL
// itself is valid for 2h). Same approach as the community documents.
const getCachedSignedUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, 60 * 60 * 2);
    return data?.signedUrl ?? null;
  },
  ["store-pdf-signed-url"],
  { revalidate: 60 * 60 }
);

/** Everything the /grocery page needs, including a signed PDF URL in PDF mode. */
export async function getStoreView(): Promise<{
  label: string;
  mode: "text" | "pdf";
  body: string;
  url: string | null;
  kind: "pdf" | "image";
  configured: boolean;
}> {
  const s = await getStoreInfo();
  const url = s.mode === "pdf" && s.file_path ? await getCachedSignedUrl(s.file_path) : null;
  return {
    label: s.menu_label,
    mode: s.mode,
    body: s.body,
    url,
    kind: docKind(s.file_path),
    configured: isStoreConfigured(s),
  };
}
