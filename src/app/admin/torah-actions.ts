"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/torah-lessons");
}

export async function createLesson(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const subject = String(formData.get("subject") ?? "").trim();
  const occurrence = String(formData.get("occurrence") ?? "").trim();
  const hour = String(formData.get("hour") ?? "").trim();
  if (!subject) return { error: "יש להזין נושא לשיעור" };

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("torah_lessons")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await admin
    .from("torah_lessons")
    .insert({ subject, occurrence, hour, sort_order });
  if (error) return { error: "יצירת השיעור נכשלה" };

  revalidate();
  return { ok: true };
}

export async function updateLesson(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = String(formData.get("id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const occurrence = String(formData.get("occurrence") ?? "").trim();
  const hour = String(formData.get("hour") ?? "").trim();
  if (!id) return { error: "שיעור חסר" };
  if (!subject) return { error: "יש להזין נושא לשיעור" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("torah_lessons")
    .update({ subject, occurrence, hour })
    .eq("id", id);
  if (error) return { error: "עדכון השיעור נכשל" };

  revalidate();
  return { ok: true };
}

export async function toggleLessonVisible(id: string, visible: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "שיעור חסר" };
  const admin = createAdminClient();
  const { error } = await admin.from("torah_lessons").update({ is_visible: visible }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };
  revalidate();
  return { ok: true };
}

export async function deleteLesson(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "שיעור חסר" };
  const admin = createAdminClient();
  const { error } = await admin.from("torah_lessons").delete().eq("id", id);
  if (error) return { error: "מחיקת השיעור נכשלה" };
  revalidate();
  return { ok: true };
}

/** Reorder (up/down) — normalizes sort_order across all lessons. */
export async function moveLesson(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("torah_lessons")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);
  const idx = order.indexOf(id);
  if (idx < 0) return { error: "שיעור חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true };
  [order[idx], order[target]] = [order[target], order[idx]];
  await Promise.all(order.map((lid, i) => admin.from("torah_lessons").update({ sort_order: i }).eq("id", lid)));
  revalidate();
  return { ok: true };
}
