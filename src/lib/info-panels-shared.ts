/**
 * Client-safe types and pure helpers for info panels. Kept separate from
 * info-panels.ts (which imports the server-only Supabase client) so client
 * components can use these without pulling server code into the browser bundle.
 */

export interface InfoPanel {
  slug: string;
  menu_label: string;
  mode: "text" | "pdf";
  body: string;
  file_path: string | null;
  file_name: string | null;
}

/** The supported panels. A slug must be listed here to be editable/renderable. */
export const PANEL_SLUGS = ["clinic", "store"] as const;
export type PanelSlug = (typeof PANEL_SLUGS)[number];

export function isPanelSlug(s: string): s is PanelSlug {
  return (PANEL_SLUGS as readonly string[]).includes(s);
}

export function panelHref(slug: string): string {
  return `/info/${slug}`;
}

/** True once there's something to show for the active mode. */
export function isPanelConfigured(p: InfoPanel): boolean {
  return p.mode === "pdf" ? !!p.file_path : p.body.trim() !== "";
}
