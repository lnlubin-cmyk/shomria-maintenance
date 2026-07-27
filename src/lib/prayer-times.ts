// Client-safe types + pure helpers for prayer schedules. No server imports here
// (this module is imported by client components). Server data-fetching lives in
// prayer-times-server.ts.

export const PRAYER_TITLES = ["שחרית", "מנחה", "ערבית", "אחר"] as const;
export type PrayerTitle = (typeof PRAYER_TITLES)[number];

export interface Minyan {
  name: string;
  time: string;
  notes: string;
  is_visible: boolean;
}

export interface Prayer {
  title: PrayerTitle;
  custom_title: string; // used when title === "אחר"
  minyanim: Minyan[];
}

export interface PrayerSchedule {
  id: string;
  title: string;
  is_visible: boolean;
  sort_order: number;
  prayers: Prayer[];
}

/** The label to display for a prayer (custom text when the title is "אחר"). */
export function prayerLabel(p: Prayer): string {
  return p.title === "אחר" ? p.custom_title.trim() || "אחר" : p.title;
}

export function normalizePrayers(raw: unknown): Prayer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const pr = (p ?? {}) as Partial<Prayer>;
    return {
      title: (PRAYER_TITLES as readonly string[]).includes(pr.title as string)
        ? (pr.title as PrayerTitle)
        : "אחר",
      custom_title: String(pr.custom_title ?? ""),
      minyanim: Array.isArray(pr.minyanim)
        ? pr.minyanim.map((m) => {
            const mm = (m ?? {}) as Partial<Minyan>;
            return {
              name: String(mm.name ?? ""),
              time: String(mm.time ?? ""),
              notes: String(mm.notes ?? ""),
              is_visible: mm.is_visible !== false,
            };
          })
        : [],
    };
  });
}

export function toSchedule(row: Record<string, unknown>): PrayerSchedule {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    is_visible: row.is_visible !== false,
    sort_order: Number(row.sort_order ?? 0),
    prayers: normalizePrayers(row.prayers),
  };
}
