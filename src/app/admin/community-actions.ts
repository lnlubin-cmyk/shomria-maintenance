"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { docExt, docContentType, DOC_KINDS_HE } from "@/lib/doc-files";
import { sanitizeRichText } from "@/lib/rich-text";
import { revalidateNav } from "@/lib/nav-cache";
import { decodeUploadedFileName } from "@/lib/upload-filename";

export type ActionResult = { error: string } | { ok: true; message?: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

/** The tile emoji, trimmed and length-capped (plain text — rendered escaped). */
function readIcon(formData: FormData): string {
  return String(formData.get("icon") ?? "").trim().slice(0, 16);
}

/** The optional one-line tile description, trimmed and length-capped. */
function readDescription(formData: FormData): string {
  return String(formData.get("description") ?? "").trim().slice(0, 160);
}

/** The optional expiration date as "YYYY-MM-DD" or null. */
function readExpiry(formData: FormData): string | null {
  const s = String(formData.get("expires_at") ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function readDoc(formData: FormData): { file: File | null; ext?: string; error?: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { file: null };
  const ext = docExt(file);
  if (!ext) return { file: null, error: `יש להעלות קובץ ${DOC_KINDS_HE}` };
  if (file.size > MAX_FILE_BYTES) return { file: null, error: "הקובץ גדול מ-20MB" };
  return { file, ext };
}

/**
 * Upload a document (PDF or image) to a fresh, random storage key — with the
 * file's real extension so its kind is knowable later — and return that key.
 * Uploading first (before touching the DB) means a failed upload can't leave an
 * orphaned row, and a random key means each file is independent of the row id.
 */
async function uploadDoc(file: File, ext: string): Promise<{ path?: string; error?: string }> {
  const admin = createAdminClient();
  const path = `${randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, bytes, { contentType: docContentType(ext), upsert: false });
  if (error) return { error: error.message };
  return { path };
}

async function removeFile(path: string | null | undefined) {
  if (!path) return;
  const admin = createAdminClient();
  await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/", "layout"); // refresh the nav menu across the site
  revalidateNav(); // drop the cross-request nav cache so the change shows now
}

/**
 * Add an item, either as free rich text or an uploaded file. A text item (with
 * content) or a file item (with a file attached) defaults to VISIBLE so it shows
 * right away; a file item without a file yet stays hidden until one is added.
 */
export async function createCommunityItem(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) return { error: "יש להזין נושא" };

  const section = String(formData.get("section") ?? "community");
  if (section !== "community" && section !== "info" && section !== "torah") return { error: "מדור לא חוקי" };

  const mode = String(formData.get("mode") ?? "file");
  if (mode !== "file" && mode !== "text") return { error: "מצב תצוגה לא חוקי" };

  const icon = readIcon(formData);
  const description = readDescription(formData);
  const expires_at = readExpiry(formData);

  const admin = createAdminClient();

  if (mode === "text") {
    const body = sanitizeRichText(String(formData.get("body") ?? ""));
    if (!body.trim()) return { error: "יש להזין תוכן טקסט" };
    const { error } = await admin
      .from("community_items")
      .insert({ subject, section, mode: "text", body, icon, description, expires_at, file_path: null, file_name: null, is_visible: true });
    if (error) return { error: "יצירת הפריט נכשלה" };
    revalidate();
    return { ok: true };
  }

  // File mode — the file is optional (it can be added later).
  const { file, ext, error: fileErr } = readDoc(formData);
  if (fileErr) return { error: fileErr };

  let file_path: string | null = null;
  let file_name: string | null = null;
  if (file && ext) {
    const { path, error } = await uploadDoc(file, ext);
    if (error || !path) return { error: "העלאת הקובץ נכשלה" };
    file_path = path;
    file_name = decodeUploadedFileName(file.name);
  }

  const { error } = await admin
    .from("community_items")
    .insert({ subject, section, mode: "file", body: "", icon, description, expires_at, file_path, file_name, is_visible: !!file });
  if (error) {
    await removeFile(file_path); // don't leave the just-uploaded file orphaned
    return { error: "יצירת הפריט נכשלה" };
  }

  revalidate();
  return { ok: true };
}

/** Update an item's tile details: subject, icon (emoji) and short description. */
export async function updateCommunityDetails(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  if (!id) return { error: "פריט חסר" };
  if (!subject) return { error: "יש להזין נושא" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_items")
    .update({ subject, icon: readIcon(formData), description: readDescription(formData), expires_at: readExpiry(formData) })
    .eq("id", id);
  if (error) return { error: "עדכון הפרטים נכשל" };

  revalidate();
  return { ok: true };
}

/** Move an item to a different menu section ("קהילה" / "מידע לתושב" / "תורה ותפילה"). */
export async function updateCommunitySection(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const section = String(formData.get("section") ?? "");
  if (!id) return { error: "פריט חסר" };
  if (section !== "community" && section !== "info" && section !== "torah") return { error: "מדור לא חוקי" };

  const admin = createAdminClient();
  const { error } = await admin.from("community_items").update({ section }).eq("id", id);
  if (error) return { error: "עדכון המדור נכשל" };

  revalidate();
  return { ok: true };
}

/**
 * Update an item's content: its display mode (file / text), the rich text, and
 * optionally a new/removed file. Both text and file are kept, so the admin can
 * toggle between them without re-entering — mirrors the info-panel editor.
 */
export async function updateCommunityContent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const mode = String(formData.get("mode") ?? "file");
  if (mode !== "file" && mode !== "text") return { error: "מצב תצוגה לא חוקי" };
  const body = sanitizeRichText(String(formData.get("body") ?? ""));

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("community_items")
    .select("file_path, file_name")
    .eq("id", id)
    .maybeSingle();

  let file_path: string | null = cur?.file_path ?? null;
  let file_name: string | null = cur?.file_name ?? null;

  const removeExisting = String(formData.get("remove_file") ?? "") === "1";
  const { file, ext, error: fileErr } = readDoc(formData);
  if (fileErr) return { error: fileErr };

  if (file && ext) {
    const { path, error } = await uploadDoc(file, ext);
    if (error || !path) return { error: "העלאת הקובץ נכשלה" };
    if (file_path) await removeFile(file_path); // drop the old file
    file_path = path;
    file_name = decodeUploadedFileName(file.name);
  } else if (removeExisting && file_path) {
    await removeFile(file_path);
    file_path = null;
    file_name = null;
  }

  if (mode === "file" && !file_path) {
    return { error: "במצב „קובץ” יש להעלות קובץ (PDF או תמונה), או לעבור לטקסט חופשי." };
  }
  if (mode === "text" && !body.trim()) {
    return { error: "במצב „טקסט חופשי” יש להזין תוכן." };
  }

  const { error } = await admin
    .from("community_items")
    .update({ mode, body, file_path, file_name })
    .eq("id", id);
  if (error) return { error: "עדכון הפריט נכשל" };

  revalidate();
  return { ok: true };
}

export async function toggleCommunityVisibility(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("is_visible") ?? "") === "true";
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("community_items").update({ is_visible: next }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };

  revalidate();
  return { ok: true };
}

export async function deleteCommunityItem(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("community_items")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("community_items").delete().eq("id", id);
  if (error) return { error: "מחיקת הפריט נכשלה" };

  await removeFile(existing?.file_path);
  revalidate();
  return { ok: true };
}
