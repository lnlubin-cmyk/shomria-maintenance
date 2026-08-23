import { createAdminClient } from "@/lib/supabase/server";
import { getTodayHalachicTimes } from "@/lib/halachic";
import type { HalachicTimeEntry } from "@/lib/halachic-parse";
import { toSchedule, type Minyan, type PrayerSchedule, type RelBase } from "@/lib/prayer-times";

function parseHHMM(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}
function fmtHHMM(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Find today's HH:MM for a chosen halachic base, matching stored label variants. */
function findBaseTime(times: HalachicTimeEntry[], base: RelBase): string | null {
  const find = (pred: (l: string) => boolean) => times.find((t) => pred(t.label))?.time ?? null;
  if (base === "sunrise") return find((l) => l.includes("נץ"));
  if (base === "sunset")
    return (
      find((l) => l === "שקיעה") ??
      find((l) => l.includes("שקיעה") && l.includes("גובה")) ??
      find((l) => l.includes("שקיעה") && !l.includes("לחומרא") && !l.includes("במישור"))
    );
  // tzeit at 4.9°, with a bare צה"כ fallback for layouts that lack the degrees.
  return find((l) => l.includes("צה") && (l.includes("4.9") || l.includes("מעלו"))) ?? find((l) => l.includes("צה"));
}

/**
 * Resolve a relative minyan to a concrete time for today. Only the time is
 * shown to residents — the underlying rule (offset + base) is intentionally not
 * surfaced.
 */
function resolveMinyan(m: Minyan, times: HalachicTimeEntry[] | null): Minyan {
  if (m.mode !== "relative" || !m.rel_base) return m;
  const base = times ? findBaseTime(times, m.rel_base) : null;
  const baseMin = base ? parseHHMM(base) : null;
  const off = Math.abs(m.rel_offset ?? 0);
  const time = baseMin == null ? "—" : fmtHHMM(baseMin + (m.rel_dir === "after" ? off : -off));
  return { ...m, time };
}

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

  // Today's halachic times, to resolve any relative minyan times to a concrete
  // value for today.
  const today = await getTodayHalachicTimes();

  const schedule = toSchedule(data);
  schedule.prayers = schedule.prayers
    .map((p) => ({
      ...p,
      minyanim: p.minyanim.filter((m) => m.is_visible).map((m) => resolveMinyan(m, today.times)),
    }))
    .filter((p) => p.minyanim.length > 0);
  return schedule;
}
