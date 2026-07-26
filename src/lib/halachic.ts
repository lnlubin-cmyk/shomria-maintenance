import { HDate } from "@hebcal/core";
import { createAdminClient } from "@/lib/supabase/server";
import type { HalachicTimeEntry } from "@/lib/halachic-parse";

// hebcal month name -> the canonical Hebrew name we store (matches the tab names).
const HEBCAL_TO_CANONICAL: Record<string, string> = {
  Nisan: "ניסן", Iyyar: "אייר", Sivan: "סיון", Tamuz: "תמוז", Av: "אב", Elul: "אלול",
  Tishrei: "תשרי", Cheshvan: "חשוון", Kislev: "כסלו", Tevet: "טבת", "Sh'vat": "שבט",
  Adar: "אדר", "Adar I": "אדר א", "Adar II": "אדר ב",
};

/** Today's civil date in Israel (independent of the server's timezone). */
function israelToday(): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export interface TodayHalachic {
  gregorianISO: string;
  hebrewDateHe: string; // e.g. "י״ב באב תשפ״ו"
  hebrewYear: number;
  monthCanonical: string;
  day: number;
  dayTitle: string | null;
  times: HalachicTimeEntry[] | null; // null when no data for this date
}

/** Compute today's Hebrew date and load its row of halachic times. */
export async function getTodayHalachicTimes(): Promise<TodayHalachic> {
  const { y, m, d } = israelToday();
  const hd = new HDate(new Date(Date.UTC(y, m - 1, d, 12)));
  const hebrewYear = hd.getFullYear();
  const monthCanonical = HEBCAL_TO_CANONICAL[hd.getMonthName()] ?? hd.getMonthName();
  const day = hd.getDate();

  const admin = createAdminClient();
  const { data } = await admin
    .from("halachic_times")
    .select("day_title, times")
    .eq("hebrew_year", hebrewYear)
    .eq("month_name", monthCanonical)
    .eq("hebrew_day", day)
    .maybeSingle();

  return {
    gregorianISO: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    hebrewDateHe: hd.renderGematriya(),
    hebrewYear,
    monthCanonical,
    day,
    dayTitle: (data?.day_title as string) ?? null,
    times: (data?.times as HalachicTimeEntry[]) ?? null,
  };
}

/** Which Hebrew years are loaded, and how many days each — for the admin tab. */
export async function getLoadedHalachicYears(): Promise<{ year: number; days: number }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("halachic_times").select("hebrew_year");
  const counts = new Map<number, number>();
  for (const r of data ?? []) counts.set(r.hebrew_year, (counts.get(r.hebrew_year) ?? 0) + 1);
  return [...counts.entries()].map(([year, days]) => ({ year, days })).sort((a, b) => b.year - a.year);
}
