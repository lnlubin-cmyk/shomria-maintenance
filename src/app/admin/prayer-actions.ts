"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { canEditReligious } from "@/lib/types";
import { PRAYER_TITLES, REL_BASES, type Minyan, type Prayer, type PrayerTitle, type RelBase } from "@/lib/prayer-times";
import { revalidateNav } from "@/lib/nav-cache";

export type ActionResult = { error: string } | { ok: true };

interface SchedulePayload {
  id?: string;
  title: string;
  is_visible: boolean;
  prayers: Prayer[];
}

async function requireReligiousEditor() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (!canEditReligious(session.user.role)) throw new Error("אין לך הרשאה");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/prayer-times", "layout");
  revalidateNav();
}

/** Clean the nested prayers/minyanim before storing. */
function sanitizePrayers(prayers: unknown): Prayer[] {
  if (!Array.isArray(prayers)) return [];
  return prayers.map((p) => {
    const pr = (p ?? {}) as Partial<Prayer>;
    const title: PrayerTitle = (PRAYER_TITLES as readonly string[]).includes(pr.title as string)
      ? (pr.title as PrayerTitle)
      : "אחר";
    const minyanim = Array.isArray(pr.minyanim)
      ? pr.minyanim
          .map((m) => {
            const mm = (m ?? {}) as Partial<Minyan>;
            const relative =
              mm.mode === "relative" && (REL_BASES as readonly string[]).includes(mm.rel_base as string);
            return {
              name: String(mm.name ?? "").trim(),
              time: relative ? "" : String(mm.time ?? "").trim(),
              notes: String(mm.notes ?? "").trim(),
              is_visible: mm.is_visible !== false,
              mode: relative ? "relative" : "fixed",
              ...(relative
                ? {
                    rel_base: mm.rel_base as RelBase,
                    rel_offset: Number.isFinite(Number(mm.rel_offset)) ? Math.max(0, Math.round(Number(mm.rel_offset))) : 0,
                    rel_dir: mm.rel_dir === "after" ? "after" : "before",
                  }
                : {}),
            } as Minyan;
          })
          .filter((m) => m.name !== "" || m.time !== "") // drop unnamed/empty rows (incl. relative)
      : [];
    return { title, custom_title: String(pr.custom_title ?? "").trim(), minyanim };
  });
}

export async function saveSchedule(payload: SchedulePayload): Promise<ActionResult> {
  try {
    await requireReligiousEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const title = String(payload?.title ?? "").trim();
  if (!title) return { error: "יש להזין כותרת ללוח" };

  const prayers = sanitizePrayers(payload?.prayers);
  const is_visible = payload?.is_visible !== false;
  const admin = createAdminClient();

  if (payload.id) {
    const { error } = await admin
      .from("prayer_schedules")
      .update({ title, is_visible, prayers })
      .eq("id", payload.id);
    if (error) return { error: "שמירת הלוח נכשלה" };
  } else {
    const { data: maxRow } = await admin
      .from("prayer_schedules")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (maxRow?.sort_order ?? -1) + 1;
    const { error } = await admin
      .from("prayer_schedules")
      .insert({ title, is_visible, prayers, sort_order });
    if (error) return { error: "יצירת הלוח נכשלה" };
  }

  revalidate();
  return { ok: true };
}

export async function toggleScheduleVisible(id: string, visible: boolean): Promise<ActionResult> {
  try {
    await requireReligiousEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "פריט חסר" };
  const admin = createAdminClient();
  const { error } = await admin
    .from("prayer_schedules")
    .update({ is_visible: visible })
    .eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };
  revalidate();
  return { ok: true };
}

export async function deleteSchedule(id: string): Promise<ActionResult> {
  try {
    await requireReligiousEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "פריט חסר" };
  const admin = createAdminClient();
  const { error } = await admin.from("prayer_schedules").delete().eq("id", id);
  if (error) return { error: "מחיקת הלוח נכשלה" };
  revalidate();
  return { ok: true };
}

/** Reorder schedules (up/down) — normalizes sort_order across all rows. */
export async function moveSchedule(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireReligiousEditor();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("prayer_schedules")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);
  const idx = order.indexOf(id);
  if (idx < 0) return { error: "פריט חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true };
  [order[idx], order[target]] = [order[target], order[idx]];
  await Promise.all(order.map((sid, i) => admin.from("prayer_schedules").update({ sort_order: i }).eq("id", sid)));
  revalidate();
  return { ok: true };
}
