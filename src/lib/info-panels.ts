import { cache } from "react";
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

// Freshly-signed URL per request (NOT cached): a cached signed URL is served
// stale-while-revalidate and can be handed out after it has expired, failing
// with Supabase "InvalidJWT / exp claim". The /info/[slug] page is dynamic, so
// this runs per visit.
async function getSignedUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, 60 * 60 * 2);
  return data?.signedUrl ?? null;
}

/** Everything the /info/[slug] page needs, or null if the panel doesn't exist. */
export async function getPanelView(slug: string): Promise<
  | { label: string; mode: "text" | "pdf"; body: string; url: string | null; kind: "pdf" | "image"; configured: boolean }
  | null
> {
  const p = await getInfoPanel(slug);
  if (!p) return null;
  const url = p.mode === "pdf" && p.file_path ? await getSignedUrl(p.file_path) : null;
  return {
    label: p.menu_label,
    mode: p.mode,
    body: p.body,
    url,
    kind: docKind(p.file_path),
    configured: isPanelConfigured(p),
  };
}
