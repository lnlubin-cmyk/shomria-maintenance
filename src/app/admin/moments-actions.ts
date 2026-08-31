"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { detectMoment } from "@/lib/moments-embed";
import { revalidateNav } from "@/lib/nav-cache";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/"); // home-page קהילה tile
  revalidatePath("/moments"); // the gallery
  revalidateNav();
}

const LINK_ERROR =
  "הקישור אינו נתמך. יש להזין קישור YouTube, Google Drive, Bunny, או כתובת אתר תקינה.";

/** Normalise an optional date field to a "YYYY-MM-DD" string or null. */
function readDate(formData: FormData, field = "event_date"): string | null {
  const s = String(formData.get(field) ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Add a moment. New moments are visible by default (appear right away). */
export async function createMoment(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "יש להזין כותרת" };

  const detected = detectMoment(String(formData.get("url") ?? ""));
  if (!detected) return { error: LINK_ERROR };

  const description = String(formData.get("description") ?? "").trim();
  const event_date = readDate(formData);

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("community_moments")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await admin.from("community_moments").insert({
    title,
    description,
    provider: detected.provider,
    ref: detected.ref,
    event_date,
    expires_at: readDate(formData, "expires_at"),
    is_visible: true,
    sort_order,
  });
  if (error) return { error: "שמירת הרגע נכשלה" };

  revalidate();
  return { ok: true };
}

/** Edit the title / description / date (not the link). */
export async function updateMomentDetails(formData: FormData): Promise<ActionResult> {
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
    .from("community_moments")
    .update({
      title,
      description: String(formData.get("description") ?? "").trim(),
      event_date: readDate(formData),
      expires_at: readDate(formData, "expires_at"),
    })
    .eq("id", id);
  if (error) return { error: "עדכון הרגע נכשל" };

  revalidate();
  return { ok: true };
}

/** Replace the link (re-detecting the provider from the new URL). */
export async function updateMomentLink(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const detected = detectMoment(String(formData.get("url") ?? ""));
  if (!detected) return { error: LINK_ERROR };

  const admin = createAdminClient();
  const { error } = await admin
    .from("community_moments")
    .update({ provider: detected.provider, ref: detected.ref })
    .eq("id", id);
  if (error) return { error: "עדכון הקישור נכשל" };

  revalidate();
  return { ok: true };
}

export async function toggleMomentVisibility(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("is_visible") ?? "") === "true";
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("community_moments").update({ is_visible: next }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };

  revalidate();
  return { ok: true };
}

export async function deleteMoment(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("community_moments").delete().eq("id", id);
  if (error) return { error: "מחיקת הרגע נכשלה" };

  revalidate();
  return { ok: true };
}

/** Move a moment earlier/later in the gallery (normalizes sort_order). */
export async function moveMoment(formData: FormData): Promise<ActionResult> {
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
    .from("community_moments")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);

  const idx = order.indexOf(id);
  if (idx < 0) return { error: "פריט חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true }; // already at the edge

  [order[idx], order[target]] = [order[target], order[idx]];
  await Promise.all(
    order.map((mid, i) => admin.from("community_moments").update({ sort_order: i }).eq("id", mid))
  );

  revalidate();
  return { ok: true };
}
