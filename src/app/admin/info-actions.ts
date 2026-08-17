"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { docExt, docContentType, DOC_KINDS_HE } from "@/lib/doc-files";
import { sanitizeRichText } from "@/lib/rich-text";
import { isPanelSlug } from "@/lib/info-panels";

export type ActionResult = { error: string } | { ok: true };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

/**
 * Save one info panel (מכולת / מרפאה …): the menu label, the display mode
 * (text / file), the rich text, and optionally a new/removed file. Both the text
 * and the file are kept so the admin can toggle between them without re-entering.
 */
export async function updatePanel(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const slug = String(formData.get("slug") ?? "");
  if (!isPanelSlug(slug)) return { error: "פריט לא חוקי" };

  const mode = String(formData.get("mode") ?? "text");
  if (mode !== "text" && mode !== "pdf") return { error: "מצב תצוגה לא חוקי" };
  const body = sanitizeRichText(String(formData.get("body") ?? ""));

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("info_panels")
    .select("menu_label, file_path, file_name")
    .eq("slug", slug)
    .maybeSingle();

  const menu_label = String(formData.get("menu_label") ?? "").trim() || cur?.menu_label || slug;
  let file_path: string | null = cur?.file_path ?? null;
  let file_name: string | null = cur?.file_name ?? null;

  const removeFile = String(formData.get("remove_file") ?? "") === "1";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const ext = docExt(file);
    if (!ext) return { error: `יש להעלות קובץ ${DOC_KINDS_HE}` };
    if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ-20MB" };
    const path = `${randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const up = await admin.storage
      .from(COMMUNITY_BUCKET)
      .upload(path, bytes, { contentType: docContentType(ext), upsert: false });
    if (up.error) return { error: "העלאת הקובץ נכשלה" };
    if (file_path) await admin.storage.from(COMMUNITY_BUCKET).remove([file_path]);
    file_path = path;
    file_name = file.name;
  } else if (removeFile && file_path) {
    await admin.storage.from(COMMUNITY_BUCKET).remove([file_path]);
    file_path = null;
    file_name = null;
  }

  if (mode === "pdf" && !file_path) {
    return { error: "במצב „קובץ” יש להעלות קובץ (PDF או תמונה), או לעבור למצב טקסט חופשי." };
  }

  const { error } = await admin
    .from("info_panels")
    .update({ menu_label, mode, body, file_path, file_name, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { error: "שמירת ההגדרות נכשלה" };

  revalidatePath("/admin");
  revalidatePath(`/info/${slug}`);
  revalidatePath("/", "layout"); // refresh the menu + home tile
  return { ok: true };
}
