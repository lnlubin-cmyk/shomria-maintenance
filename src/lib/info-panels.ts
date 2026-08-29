import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { docKind } from "@/lib/doc-files";
import {
  isPanelConfigured,
  PANEL_SLUGS,
  isPanelSlug,
  panelHref,
  type InfoPanel,
  type PanelSlug,
} from "@/lib/info-panels-shared";

/**
 * "Info panels" are single admin-configurable items shown under "מידע לתושב"
 * (e.g. מכולת, מרפאה). Each shows either free (rich) text or an uploaded
 * file (PDF/image), and appears in the menu / home only once it has content.
 * They all share this one table + UI + page; adding another is just a new slug.
 *
 * Server-only data access. Types and pure helpers live in info-panels-shared.ts
 * (re-exported here) so client components can use them without server code.
 */
export { isPanelConfigured, PANEL_SLUGS, isPanelSlug, panelHref };
export type { InfoPanel, PanelSlug };

const COLS = "slug, menu_label, mode, body, file_path, file_name";

/** All panels, in menu order. React-cached so menu + home share one lookup. */
export const getInfoPanels = cache(async (): Promise<InfoPanel[]> => {
  const admin = createAdminClient();
  const { data } = await admin.from("info_panels").select(COLS).order("sort_order");
  return (data ?? []) as InfoPanel[];
});

/** One panel by slug (React-cached per slug). */
export const getInfoPanel = cache(async (slug: string): Promise<InfoPanel | null> => {
  const admin = createAdminClient();
  const { data } = await admin.from("info_panels").select(COLS).eq("slug", slug).maybeSingle();
  return (data as InfoPanel | null) ?? null;
});

// Signed URL valid for 30 days but reused (cached) for an hour — same rationale
// as community.ts: the long validity means a stale-served URL is effectively
// never expired, while a stable URL lets the browser cache the file.
const getSignedUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
    return data?.signedUrl ?? null;
  },
  ["info-panel-signed-url-30d"],
  { revalidate: 60 * 60 }
);

// Attachment-disposition URL for the "הורד קובץ" button (hands the file to the
// device's own viewer). See community.ts for the rationale.
const getSignedDownloadUrl = unstable_cache(
  async (path: string, filename: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(COMMUNITY_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 30, { download: filename || true });
    return data?.signedUrl ?? null;
  },
  ["info-panel-download-url-30d"],
  { revalidate: 60 * 60 }
);

/** Everything the /info/[slug] page needs, or null if the panel doesn't exist. */
export async function getPanelView(slug: string): Promise<
  | {
      label: string;
      mode: "text" | "pdf";
      body: string;
      url: string | null;
      downloadUrl: string | null;
      kind: "pdf" | "image";
      configured: boolean;
    }
  | null
> {
  const p = await getInfoPanel(slug);
  if (!p) return null;
  const hasFile = p.mode === "pdf" && !!p.file_path;
  const url = hasFile ? await getSignedUrl(p.file_path!) : null;
  const downloadUrl = hasFile ? await getSignedDownloadUrl(p.file_path!, p.file_name ?? "") : null;
  return {
    label: p.menu_label,
    mode: p.mode,
    body: p.body,
    url,
    downloadUrl,
    kind: docKind(p.file_path),
    configured: isPanelConfigured(p),
  };
}
