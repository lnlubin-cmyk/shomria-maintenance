"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { sanitizeRichText } from "@/lib/rich-text";
import { revalidateNav } from "@/lib/nav-cache";

export type ActionResult = { error: string } | { ok: true };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/"); // the home-page carousel
  revalidateNav();
}

/** Normalise the optional date fields to "YYYY-MM-DD" or null. */
function readDate(formData: FormData, field: string): string | null {
  const s = String(formData.get(field) ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function imageExt(file: File): string | null {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && (IMAGE_EXTS as readonly string[]).includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  const fromType = file.type.split("/")[1]?.toLowerCase();
  if (fromType && (IMAGE_EXTS as readonly string[]).includes(fromType)) return fromType === "jpeg" ? "jpg" : fromType;
  return null;
}

function readImage(formData: FormData): { file: File | null; ext?: string; error?: string } {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { file: null };
  const ext = imageExt(file);
  if (!ext) return { file: null, error: "יש להעלות תמונה (JPG/PNG/WEBP/GIF)" };
  if (file.size > MAX_FILE_BYTES) return { file: null, error: "התמונה גדולה מ-20MB" };
  return { file, ext };
}

async function uploadImage(file: File, ext: string): Promise<{ path?: string; error?: string }> {
  const admin = createAdminClient();
  const path = `${randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: CONTENT_TYPE[ext] ?? "image/jpeg", upsert: false });
  if (error) return { error: error.message };
  return { path };
}

async function removeFile(path: string | null | undefined) {
  if (!path) return;
  const admin = createAdminClient();
  await admin.storage.from(COMMUNITY_BUCKET).remove([path]);
}
const removeImage = removeFile;

/** The optional PDF for the event's full page. */
function readEventDoc(formData: FormData): { file: File | null; error?: string } {
  const file = formData.get("doc");
  if (!(file instanceof File) || file.size === 0) return { file: null };
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return { file: null, error: "יש להעלות קובץ PDF" };
  if (file.size > MAX_FILE_BYTES) return { file: null, error: "הקובץ גדול מ-20MB" };
  return { file };
}

async function uploadEventDoc(file: File): Promise<{ path?: string; error?: string }> {
  const admin = createAdminClient();
  const path = `${randomUUID()}.pdf`;
  const { error } = await admin.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: "application/pdf", upsert: false });
  if (error) return { error: error.message };
  return { path };
}

/** Add an event. Visible by default so it appears in the carousel right away. */
export async function createEvent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "יש להזין כותרת" };

  const { file, ext, error: fileErr } = readImage(formData);
  if (fileErr) return { error: fileErr };

  let image_path: string | null = null;
  let image_name: string | null = null;
  if (file && ext) {
    const { path, error } = await uploadImage(file, ext);
    if (error || !path) return { error: "העלאת התמונה נכשלה" };
    image_path = path;
    image_name = file.name;
  }

  const { file: docFile, error: docErr } = readEventDoc(formData);
  if (docErr) {
    await removeImage(image_path);
    return { error: docErr };
  }
  let doc_path: string | null = null;
  let doc_name: string | null = null;
  if (docFile) {
    const { path, error } = await uploadEventDoc(docFile);
    if (error || !path) {
      await removeImage(image_path);
      return { error: "העלאת המסמך נכשלה" };
    }
    doc_path = path;
    doc_name = docFile.name;
  }

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("community_events")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await admin.from("community_events").insert({
    title,
    body: sanitizeRichText(String(formData.get("body") ?? "")),
    event_date: readDate(formData, "event_date"),
    expires_at: readDate(formData, "expires_at"),
    image_path,
    image_name,
    doc_path,
    doc_name,
    is_visible: true,
    sort_order,
  });
  if (error) {
    await removeFile(image_path);
    await removeFile(doc_path);
    return { error: "שמירת האירוע נכשלה" };
  }

  revalidate();
  return { ok: true };
}

/** Edit the text fields (title / description / event date / expiry). */
export async function updateEventDetails(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!id) return { error: "פריט חסר" };
  if (!title) return { error: "יש להזין כותרת" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_events")
    .update({
      title,
      body: sanitizeRichText(String(formData.get("body") ?? "")),
      event_date: readDate(formData, "event_date"),
      expires_at: readDate(formData, "expires_at"),
    })
    .eq("id", id);
  if (error) return { error: "עדכון האירוע נכשל" };

  revalidate();
  return { ok: true };
}

/** Replace or remove the event image. */
export async function updateEventImage(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("community_events")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();

  const removeExisting = String(formData.get("remove_image") ?? "") === "1";
  const { file, ext, error: fileErr } = readImage(formData);
  if (fileErr) return { error: fileErr };

  let image_path: string | null = cur?.image_path ?? null;
  let image_name: string | null = null;
  if (file && ext) {
    const { path, error } = await uploadImage(file, ext);
    if (error || !path) return { error: "העלאת התמונה נכשלה" };
    if (cur?.image_path) await removeImage(cur.image_path);
    image_path = path;
    image_name = file.name;
  } else if (removeExisting && cur?.image_path) {
    await removeImage(cur.image_path);
    image_path = null;
  } else {
    return { ok: true }; // nothing to do
  }

  const { error } = await admin
    .from("community_events")
    .update({ image_path, image_name })
    .eq("id", id);
  if (error) return { error: "עדכון התמונה נכשל" };

  revalidate();
  return { ok: true };
}

/** Replace or remove the event's PDF document (shown on its full page). */
export async function updateEventDoc(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("community_events")
    .select("doc_path")
    .eq("id", id)
    .maybeSingle();

  const removeExisting = String(formData.get("remove_doc") ?? "") === "1";
  const { file, error: docErr } = readEventDoc(formData);
  if (docErr) return { error: docErr };

  let doc_path: string | null = cur?.doc_path ?? null;
  let doc_name: string | null = null;
  if (file) {
    const { path, error } = await uploadEventDoc(file);
    if (error || !path) return { error: "העלאת המסמך נכשלה" };
    if (cur?.doc_path) await removeFile(cur.doc_path);
    doc_path = path;
    doc_name = file.name;
  } else if (removeExisting && cur?.doc_path) {
    await removeFile(cur.doc_path);
    doc_path = null;
  } else {
    return { ok: true }; // nothing to do
  }

  const { error } = await admin
    .from("community_events")
    .update({ doc_path, doc_name })
    .eq("id", id);
  if (error) return { error: "עדכון המסמך נכשל" };

  revalidate();
  return { ok: true };
}

export async function toggleEventVisibility(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("is_visible") ?? "") === "true";
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("community_events").update({ is_visible: next }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };

  revalidate();
  return { ok: true };
}

export async function deleteEvent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: cur } = await admin
    .from("community_events")
    .select("image_path, doc_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("community_events").delete().eq("id", id);
  if (error) return { error: "מחיקת האירוע נכשלה" };

  await removeFile(cur?.image_path);
  await removeFile(cur?.doc_path);
  revalidate();
  return { ok: true };
}

/** Move an event earlier/later in the carousel (normalizes sort_order). */
export async function moveEvent(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("community_events")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);

  const idx = order.indexOf(id);
  if (idx < 0) return { error: "פריט חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true };

  [order[idx], order[target]] = [order[target], order[idx]];
  await Promise.all(
    order.map((mid, i) => admin.from("community_events").update({ sort_order: i }).eq("id", mid))
  );

  revalidate();
  return { ok: true };
}
