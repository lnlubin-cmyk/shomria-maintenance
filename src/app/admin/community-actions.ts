"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";

export type ActionResult = { error: string } | { ok: true; message?: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

/** Storage key for an item's PDF. One key per item; replacing overwrites it. */
function filePath(id: string): string {
  return `${id}.pdf`;
}

function readPdf(formData: FormData): { file: File | null; error?: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { file: null };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { file: null, error: "יש להעלות קובץ PDF בלבד" };
  if (file.size > MAX_FILE_BYTES) return { file: null, error: "הקובץ גדול מ-20MB" };
  return { file };
}

async function uploadPdf(id: string, file: File): Promise<string | null> {
  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(filePath(id), bytes, { contentType: "application/pdf", upsert: true });
  return error ? error.message : null;
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/", "layout"); // refresh the nav menu across the site
}

/** Add an item: subject required; a PDF is optional (can be added later). */
export async function createCommunityItem(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) return { error: "יש להזין נושא" };

  const { file, error: fileErr } = readPdf(formData);
  if (fileErr) return { error: fileErr };

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("community_items")
    .insert({ subject })
    .select("id")
    .single();
  if (error || !inserted) return { error: "יצירת הפריט נכשלה" };

  if (file) {
    const upErr = await uploadPdf(inserted.id, file);
    if (upErr) {
      await admin.from("community_items").delete().eq("id", inserted.id);
      return { error: "העלאת הקובץ נכשלה" };
    }
    await admin
      .from("community_items")
      .update({ file_path: filePath(inserted.id), file_name: file.name })
      .eq("id", inserted.id);
  }

  revalidate();
  return { ok: true };
}

export async function updateCommunitySubject(formData: FormData): Promise<ActionResult> {
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
  const { error } = await admin.from("community_items").update({ subject }).eq("id", id);
  if (error) return { error: "עדכון הנושא נכשל" };

  revalidate();
  return { ok: true };
}

/** Replace (or add) the item's PDF. */
export async function replaceCommunityFile(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const { file, error: fileErr } = readPdf(formData);
  if (fileErr) return { error: fileErr };
  if (!file) return { error: "לא נבחר קובץ" };

  const upErr = await uploadPdf(id, file);
  if (upErr) return { error: "העלאת הקובץ נכשלה" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_items")
    .update({ file_path: filePath(id), file_name: file.name })
    .eq("id", id);
  if (error) return { error: "עדכון הפריט נכשל" };

  revalidate();
  return { ok: true };
}

/** Remove just the file, keeping the item (it won't show in the menu without one). */
export async function removeCommunityFile(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  await admin.storage.from(COMMUNITY_BUCKET).remove([filePath(id)]);
  const { error } = await admin
    .from("community_items")
    .update({ file_path: null, file_name: null })
    .eq("id", id);
  if (error) return { error: "הסרת הקובץ נכשלה" };

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
  await admin.storage.from(COMMUNITY_BUCKET).remove([filePath(id)]);
  const { error } = await admin.from("community_items").delete().eq("id", id);
  if (error) return { error: "מחיקת הפריט נכשלה" };

  revalidate();
  return { ok: true };
}
