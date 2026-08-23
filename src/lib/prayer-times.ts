// Client-safe types + pure helpers for prayer schedules. No server imports here
// (this module is imported by client components). Server data-fetching lives in
// prayer-times-server.ts.

export const PRAYER_TITLES = ["שחרית", "מנחה", "ערבית", "אחר"] as const;
export type PrayerTitle = (typeof PRAYER_TITLES)[number];

// Halachic times a minyan time may be defined relative to.
export const REL_BASES = ["sunrise", "sunset", "tzeit49"] as const;
export type RelBase = (typeof REL_BASES)[number];
export const REL_BASE_LABELS: Record<RelBase, string> = {
  sunrise: "הנץ הנראה",
  sunset: "שקיעה",
  tzeit49: 'צה"כ 4.9 מעלות',
};

export interface Minyan {
  name: string;
  time: string; // fixed time (used when mode !== "relative")
  notes: string;
  is_visible: boolean;
  // A minyan time can be fixed, or relative to a halachic time (computed daily).
  mode?: "fixed" | "relative";
  rel_base?: RelBase;
  rel_offset?: number; // whole minutes, >= 0
  rel_dir?: "before" | "after";
}

/** Human description of a relative minyan rule, e.g. "20 דק' לפני הנץ הנראה". */
export function relRuleText(m: Minyan): string {
  if (m.mode !== "relative" || !m.rel_base) return "";
  const dir = m.rel_dir === "after" ? "אחרי" : "לפני";
  return `${Math.abs(m.rel_offset ?? 0)} דק' ${dir} ${REL_BASE_LABELS[m.rel_base]}`;
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
            const mode = mm.mode === "relative" ? "relative" : "fixed";
            const rel_base = (REL_BASES as readonly string[]).includes(mm.rel_base as string)
              ? (mm.rel_base as RelBase)
              : undefined;
            return {
              name: String(mm.name ?? ""),
              time: String(mm.time ?? ""),
              notes: String(mm.notes ?? ""),
              is_visible: mm.is_visible !== false,
              mode,
              rel_base,
              rel_offset: Number.isFinite(Number(mm.rel_offset)) ? Math.max(0, Math.round(Number(mm.rel_offset))) : 0,
              rel_dir: mm.rel_dir === "after" ? "after" : "before",
            } as Minyan;
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
