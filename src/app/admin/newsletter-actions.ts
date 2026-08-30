"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { isAIConfigured } from "@/lib/ai";
import { renderNewsletter, cropSection } from "@/lib/newsletter/render";
import { cropSectionToPdf } from "@/lib/newsletter/crop-pdf";
import { suggestSections, type SectionSuggestion } from "@/lib/newsletter/ai";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // matches the 'community' bucket size limit
const WORK_PREFIX = "newsletter-work"; // temp working files, cleaned up on publish
const SECTIONS = ["community", "info", "torah"] as const;
type SectionKey = (typeof SECTIONS)[number];
// Beyond the menu SECTIONS, a crop may target "clinic" (updates the מרפאה
// info-panel) or "events" (creates an אירועים carousel card from the image).
const TARGETS = ["community", "info", "torah", "clinic", "events"] as const;
type TargetKey = (typeof TARGETS)[number];

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

export interface AnalyzedPage {
  index: number;
  url: string; // signed URL of the frame-free preview
  w: number;
  h: number;
}

export interface AnalyzeResult {
  token: string; // work-dir id used later by publish
  pages: AnalyzedPage[];
  suggestions: SectionSuggestion[];
  aiUsed: boolean;
}

/**
 * Step 1 — upload a newsletter PDF, render frame-free page previews, and (when
 * configured) ask the AI to propose section boxes. The source PDF and previews
 * are stored under a temp work dir keyed by `token`; publish reads them back.
 */
export async function analyzeNewsletter(formData: FormData): Promise<{ error: string } | AnalyzeResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "יש להעלות קובץ ידיעון" };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { error: "יש להעלות קובץ PDF בלבד" };
  if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ-20MB" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const token = randomUUID();
  const admin = createAdminClient();

  const src = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(`${WORK_PREFIX}/${token}/source.pdf`, Buffer.from(bytes), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (src.error) return { error: "שמירת הידיעון נכשלה" };

  let pages;
  try {
    pages = renderNewsletter(bytes);
  } catch {
    await cleanupWork(token);
    return { error: "עיבוד קובץ הידיעון נכשל (ודא שזהו PDF תקין)" };
  }

  // Previews are returned inline as data URLs — they're only needed during the
  // review session, so there's nothing to store (or clean up) for them.
  const analyzed: AnalyzedPage[] = pages.map((p) => ({
    index: p.index,
    url: `data:image/jpeg;base64,${Buffer.from(p.jpeg).toString("base64")}`,
    w: p.previewW,
    h: p.previewH,
  }));

  const aiUsed = isAIConfigured();
  const suggestions = await suggestSections(pages.map((p) => ({ index: p.index, jpeg: p.jpeg })));

  return { token, pages: analyzed, suggestions, aiUsed };
}

export interface PublishSection {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  title: string;
  section: TargetKey;
  format: "png" | "pdf";
}

export interface PublishInput {
  token: string;
  sections: PublishSection[];
  publishFull: boolean;
  fullTitle: string;
  fullSection: SectionKey;
}

/**
 * Step 2 — crop each approved section from the stored PDF (as a PNG image, or a
 * vector PDF when the admin chose that format so links stay clickable) and
 * publish it: a community document in the chosen menu section, or the מרפאה
 * panel file for the "clinic" target. Optionally also publish the whole
 * newsletter as one document. The temp work dir is removed afterwards.
 */
export async function publishNewsletter(input: PublishInput): Promise<{ error: string } | { ok: true; count: number }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const token = String(input.token || "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "מזהה עבודה לא תקין" };

  const wanted = (input.sections ?? []).filter((s) => s.title.trim() !== "");
  if (wanted.length === 0 && !input.publishFull) return { error: "לא נבחרו מקטעים לפרסום" };

  const admin = createAdminClient();
  const { data: blob, error: dlErr } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .download(`${WORK_PREFIX}/${token}/source.pdf`);
  if (dlErr || !blob) return { error: "הידיעון לא נמצא (ייתכן שפג תוקף העבודה, נסה להעלות מחדש)" };
  const pdf = new Uint8Array(await blob.arrayBuffer());

  let count = 0;
  let clinicUpdated = false;
  for (const s of wanted) {
    if (!TARGETS.includes(s.section)) continue;
    if (!(s.x1 > s.x0 && s.y1 > s.y0)) continue;

    // Save the snapshot as the admin chose:
    //  - PDF: a VECTOR crop of the original page — links stay clickable and text
    //    selectable (the region's real content + link annotations are kept).
    //  - PNG: a rasterized image of the region (no links).
    const box = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 };
    // Events are shown as an <img> in the carousel, so they must be a PNG image
    // regardless of the chosen format.
    const format = s.section === "events" ? "png" : s.format;
    let bytes: Buffer;
    let ext: string;
    let contentType: string;
    try {
      if (format === "pdf") {
        bytes = Buffer.from(await cropSectionToPdf(pdf, s.page, box));
        ext = "pdf";
        contentType = "application/pdf";
      } else {
        bytes = Buffer.from(cropSection(pdf, s.page, box));
        ext = "png";
        contentType = "image/png";
      }
    } catch {
      continue; // skip a bad crop rather than fail the whole batch
    }
    const path = `${randomUUID()}.${ext}`;

    // "מרפאה" → update the clinic info-panel's file (rather than creating a doc).
    if (s.section === "clinic") {
      const up = await admin.storage.from(COMMUNITY_BUCKET).upload(path, bytes, { contentType, upsert: false });
      if (up.error) continue;
      const { data: cur } = await admin
        .from("info_panels")
        .select("file_path")
        .eq("slug", "clinic")
        .maybeSingle();
      const { error } = await admin
        .from("info_panels")
        .update({
          mode: "pdf", // "file" mode
          file_path: path,
          file_name: `${s.title.trim() || "מרפאה"}.${ext}`,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", "clinic");
      if (error) {
        await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
        continue;
      }
      if (cur?.file_path) await admin.storage.from(COMMUNITY_BUCKET).remove([cur.file_path]);
      clinicUpdated = true;
      count++;
      continue;
    }

    // "אירועים" → create an event carousel card from the cropped image.
    if (s.section === "events") {
      const up = await admin.storage.from(COMMUNITY_BUCKET).upload(path, bytes, { contentType, upsert: false });
      if (up.error) continue;
      const { error } = await admin.from("community_events").insert({
        title: s.title.trim(),
        image_path: path,
        image_name: `${s.title.trim()}.${ext}`,
        is_visible: true,
      });
      if (error) {
        await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
        continue;
      }
      count++;
      continue;
    }

    const up = await admin.storage.from(COMMUNITY_BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (up.error) continue;
    const { error } = await admin.from("community_items").insert({
      subject: s.title.trim(),
      section: s.section,
      file_path: path,
      file_name: `${s.title.trim()}.${ext}`,
      is_visible: true,
    });
    if (error) {
      await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
      continue;
    }
    count++;
  }

  if (input.publishFull) {
    const path = `${randomUUID()}.pdf`;
    const up = await admin.storage
      .from(COMMUNITY_BUCKET)
      .upload(path, Buffer.from(pdf), { contentType: "application/pdf", upsert: false });
    if (!up.error) {
      const section: SectionKey = SECTIONS.includes(input.fullSection) ? input.fullSection : "community";
      const { error } = await admin.from("community_items").insert({
        subject: input.fullTitle.trim() || "הידיעון האחרון",
        section,
        file_path: path,
        file_name: "newsletter.pdf",
        is_visible: true,
      });
      if (error) await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
      else count++;
    }
  }

  await cleanupWork(token);

  revalidatePath("/admin");
  revalidatePath("/", "layout");
  if (clinicUpdated) revalidatePath("/info/clinic");

  if (count === 0) return { error: "לא פורסם אף מקטע" };
  return { ok: true, count };
}

/** Remove every temp file under a work dir. */
async function cleanupWork(token: string) {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(COMMUNITY_BUCKET).list(`${WORK_PREFIX}/${token}`);
  if (data && data.length > 0) {
    await admin.storage.from(COMMUNITY_BUCKET).remove(data.map((f) => `${WORK_PREFIX}/${token}/${f.name}`));
  }
}
