"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { isAIConfigured } from "@/lib/ai";
import { renderNewsletter, cropSection } from "@/lib/newsletter/render";
import { imageToPdf } from "@/lib/newsletter/wrap-pdf";
import { suggestSections, type SectionSuggestion } from "@/lib/newsletter/ai";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // matches the 'community' bucket size limit
const WORK_PREFIX = "newsletter-work"; // temp working files, cleaned up on publish
const SECTIONS = ["community", "info", "torah"] as const;
type SectionKey = (typeof SECTIONS)[number];

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

  // Previews are returned inline as data URLs. They're only needed during the
  // review session, and the 'community' bucket permits application/pdf only —
  // so there's nothing to store (or clean up) for them.
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
  section: SectionKey;
}

export interface PublishInput {
  token: string;
  sections: PublishSection[];
  publishFull: boolean;
  fullTitle: string;
  fullSection: SectionKey;
}

/**
 * Step 2 — crop each approved section from the stored PDF, wrap it as a
 * single-page PDF, and add it as a (visible) community document in the chosen
 * menu section. Optionally also publish the whole newsletter as one document.
 * The temp work dir is removed afterwards.
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
  for (const s of wanted) {
    if (!SECTIONS.includes(s.section)) continue;
    if (!(s.x1 > s.x0 && s.y1 > s.y0)) continue;
    let filePng: Uint8Array;
    try {
      filePng = cropSection(pdf, s.page, { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 });
    } catch {
      continue; // skip a bad crop rather than fail the whole batch
    }
    const pdfBytes = await imageToPdf(filePng);
    const path = `${randomUUID()}.pdf`;
    const up = await admin.storage
      .from(COMMUNITY_BUCKET)
      .upload(path, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: false });
    if (up.error) continue;
    const { error } = await admin.from("community_items").insert({
      subject: s.title.trim(),
      section: s.section,
      file_path: path,
      file_name: `${s.title.trim()}.pdf`,
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
