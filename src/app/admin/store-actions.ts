"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";

export type ActionResult = { error: string } | { ok: true };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

/**
 * Save the מכולת settings: the menu label, the display mode (text / PDF), the
 * free text, and optionally a new/removed PDF. Both the text and the PDF are
 * kept so the admin can toggle between them without re-entering either.
 */
export async function updateStore(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const menu_label = String(formData.get("menu_label") ?? "").trim() || "מכולת";
  const mode = String(formData.get("mode") ?? "text");
  if (mode !== "text" && mode !== "pdf") return { error: "מצב תצוגה לא חוקי" };
  const body = String(formData.get("body") ?? "");

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("store_info")
    .select("file_path, file_name")
    .eq("id", true)
    .maybeSingle();
  let file_path: string | null = cur?.file_path ?? null;
  let file_name: string | null = cur?.file_name ?? null;

  const removeFile = String(formData.get("remove_file") ?? "") === "1";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return { error: "יש להעלות קובץ PDF בלבד" };
    if (file.size > MAX_FILE_BYTES) return { error: "הקובץ גדול מ-20MB" };
    const path = `${randomUUID()}.pdf`;
    const bytes = await file.arrayBuffer();
    const up = await admin.storage
      .from(COMMUNITY_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
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
    return { error: "במצב PDF יש להעלות קובץ, או לעבור למצב טקסט חופשי." };
  }

  const { error } = await admin
    .from("store_info")
    .update({ menu_label, mode, body, file_path, file_name, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { error: "שמירת ההגדרות נכשלה" };

  revalidatePath("/admin");
  revalidatePath("/grocery");
  revalidatePath("/", "layout"); // refresh the menu + home tile
  return { ok: true };
}
