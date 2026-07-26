"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { HOME_MEDIA_BUCKET } from "@/lib/home-media";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/"); // the home-page carousel
}

function extFor(fileName: string, contentType: string): string {
  const fromName = fileName.includes(".") ? fileName.split(".").pop()! : "";
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return contentType.split("/")[1] ?? "bin";
}

/**
 * Issue a signed URL the browser uses to upload a media file DIRECTLY to
 * Storage — big videos never pass through the serverless function (which caps
 * request bodies at a few MB). Returns the storage path + upload token.
 */
export async function createSignedUpload(
  fileName: string,
  contentType: string
): Promise<{ path: string; token: string } | { error: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return { error: "יש להעלות קובץ תמונה או וידאו בלבד" };
  }

  const path = `${randomUUID()}.${extFor(fileName, contentType)}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(HOME_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "יצירת קישור ההעלאה נכשלה" };

  return { path: data.path, token: data.token };
}

/** Record an uploaded media file. New media is active by default (plays now). */
export async function createHomeMedia(
  path: string,
  fileName: string,
  contentType: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!path) return { error: "נתיב קובץ חסר" };

  const kind = contentType.startsWith("video/") ? "video" : "image";
  const admin = createAdminClient();

  const { data: maxRow } = await admin
    .from("home_media")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await admin.from("home_media").insert({
    kind,
    file_path: path,
    file_name: fileName,
    mime_type: contentType,
    is_active: true,
    sort_order,
  });
  if (error) {
    await admin.storage.from(HOME_MEDIA_BUCKET).remove([path]);
    return { error: "שמירת המדיה נכשלה" };
  }

  revalidate();
  return { ok: true };
}

export async function setHomeMediaActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("home_media").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };

  revalidate();
  return { ok: true };
}

export async function deleteHomeMedia(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("home_media")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin.from("home_media").delete().eq("id", id);
  if (error) return { error: "מחיקת המדיה נכשלה" };

  if (row?.file_path) await admin.storage.from(HOME_MEDIA_BUCKET).remove([row.file_path]);
  revalidate();
  return { ok: true };
}

/** Move an item earlier/later in playback order (normalizes sort_order). */
export async function moveHomeMedia(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("home_media")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);

  const idx = order.indexOf(id);
  if (idx < 0) return { error: "פריט חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true }; // already at the edge

  [order[idx], order[target]] = [order[target], order[idx]];
  // Rewrite sort_order sequentially so the new order sticks (and ties are gone).
  await Promise.all(order.map((mid, i) => admin.from("home_media").update({ sort_order: i }).eq("id", mid)));

  revalidate();
  return { ok: true };
}
