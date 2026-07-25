"use server";

import { randomUUID } from "node:crypto";
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

function readPdf(formData: FormData): { file: File | null; error?: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { file: null };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { file: null, error: "יש להעלות קובץ PDF בלבד" };
  if (file.size > MAX_FILE_BYTES) return { file: null, error: "הקובץ גדול מ-20MB" };
  return { file };
}

/**
 * Upload a PDF to a fresh, random storage key and return that key. Uploading
 * first (before touching the DB) means a failed upload can't leave an orphaned
 * row, and a random key means each file is independent of the row id.
 */
async function uploadPdf(file: File): Promise<{ path?: string; error?: string }> {
  const admin = createAdminClient();
  const path = `${randomUUID()}.pdf`;
  const bytes = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
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
}

/**
 * Add an item. If a PDF is attached, the item defaults to VISIBLE so it appears
 * in the menu right away (admins can hide it later). Without a file it's hidden
 * (it can't be shown until a file is added anyway).
 */
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

  let file_path: string | null = null;
  let file_name: string | null = null;
  if (file) {
    const { path, error } = await uploadPdf(file);
    if (error || !path) return { error: "העלאת הקובץ נכשלה" };
    file_path = path;
    file_name = file.name;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_items")
    .insert({ subject, file_path, file_name, is_visible: !!file });
  if (error) {
    await removeFile(file_path); // don't leave the just-uploaded file orphaned
    return { error: "יצירת הפריט נכשלה" };
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

/** Replace (or add) the item's PDF: upload the new one, then drop the old file. */
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

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("community_items")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { path, error: upErr } = await uploadPdf(file);
  if (upErr || !path) return { error: "העלאת הקובץ נכשלה" };

  const { error } = await admin
    .from("community_items")
    .update({ file_path: path, file_name: file.name })
    .eq("id", id);
  if (error) {
    await removeFile(path);
    return { error: "עדכון הפריט נכשל" };
  }

  await removeFile(existing?.file_path); // old file no longer referenced
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
  const { data: existing } = await admin
    .from("community_items")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin
    .from("community_items")
    .update({ file_path: null, file_name: null, is_visible: false })
    .eq("id", id);
  if (error) return { error: "הסרת הקובץ נכשלה" };

  await removeFile(existing?.file_path);
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
