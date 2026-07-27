import { createAdminClient } from "@/lib/supabase/server";
import { toSchedule, type PrayerSchedule } from "@/lib/prayer-times";

/** All schedules (visible + hidden), for the admin tab. */
export async function getAllSchedules(): Promise<PrayerSchedule[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prayer_schedules")
    .select("*")
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map(toSchedule);
}

/** Visible schedules (id + title) for the landing list and nav. */
export async function getVisibleScheduleList(): Promise<{ id: string; title: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("prayer_schedules")
    .select("id, title")
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map((r) => ({ id: String(r.id), title: String(r.title ?? "") }));
}

/**
 * One schedule for viewing: only if visible, with minyanim filtered to visible
 * ones and prayers that have at least one visible minyan.
 */
export async function getScheduleForView(id: string): Promise<PrayerSchedule | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("prayer_schedules").select("*").eq("id", id).maybeSingle();
  if (!data || data.is_visible === false) return null;

  const schedule = toSchedule(data);
  schedule.prayers = schedule.prayers
    .map((p) => ({ ...p, minyanim: p.minyanim.filter((m) => m.is_visible) }))
    .filter((p) => p.minyanim.length > 0);
  return schedule;
}
