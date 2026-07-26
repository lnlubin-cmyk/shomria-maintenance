import * as XLSX from "xlsx";

/**
 * Parses the community's yearly halachic-times Excel into DB-ready rows. The
 * file has one tab per Hebrew month (12, or 13 in a leap year with אדר א / אדר
 * ב). Two header layouts exist and are both handled:
 *   - "old" layout (תשרי–שבט): terse two-row headers; labels are fixed by column.
 *   - "new" layout (אדר onward): full labels already in the header row.
 * A column is treated as a time if its value looks like H:MM(:SS).
 */

export interface HalachicTimeEntry {
  label: string;
  time: string;
}
export interface HalachicDay {
  hebrew_day: number;
  day_title: string | null;
  gregorian_day: number | null;
  times: HalachicTimeEntry[];
}
export interface HalachicMonth {
  month_name: string;
  days: HalachicDay[];
}
export interface ParsedHalachic {
  hebrew_year: number;
  months: HalachicMonth[];
}

const GEMATRIA: Record<string, number> = {
  א:1,ב:2,ג:3,ד:4,ה:5,ו:6,ז:7,ח:8,ט:9,י:10,כ:20,ך:20,ל:30,מ:40,ם:40,
  נ:50,ן:50,ס:60,ע:70,פ:80,ף:80,צ:90,ץ:90,ק:100,ר:200,ש:300,ת:400,
};

/** "ט״ו" -> 15, "כ״א" -> 21, "ל׳" -> 30. Non-letters ignored. Returns 0 if none. */
export function gematriaToInt(s: unknown): number {
  if (s == null) return 0;
  return [...String(s)].reduce((n, ch) => n + (GEMATRIA[ch] ?? 0), 0);
}

const isTime = (v: unknown): v is string =>
  typeof v === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(v.trim());

/** Expand the abbreviations the community asked to spell out (both quote forms). */
export function expandAbbrev(label: string): string {
  return label
    .replace(/עלה["״]ש/g, "עלות השחר")
    .replace(/עה["״]ש/g, "עלות השחר")
    .replace(/סזק["״]ש/g, "סוף זמן קריאת שמע")
    .replace(/סז["״]ת/g, "סוף זמן תפילה")
    .replace(/הד["״]נ/g, "הדלקת נרות")
    .replace(/\s+/g, " ")
    .trim();
}

// Old-layout (תשרי–שבט) labels, keyed by column index (its header row is fixed).
const OLD_LAYOUT_LABELS: Record<number, string> = {
  4: 'עלות השחר (90 דק\')',
  5: 'עלות השחר (72 דק\')',
  6: "הנחת תפילין",
  7: "הנץ",
  8: 'סוף זמן קריאת שמע (מג"א)',
  9: 'סוף זמן קריאת שמע (גר"א)',
  10: 'סוף זמן תפילה (מג"א)',
  11: 'סוף זמן תפילה (גר"א)',
  12: "חצות",
  13: "מנחה גדולה",
  14: "הדלקת נרות",
  15: "שקיעה (לחומרא)",
  16: "שקיעה",
  17: 'צה"כ',
  18: 'ר"ת',
};

/** Canonical Hebrew month name from a tab title (strips year suffix / variants). */
export function tabToCanonicalMonth(tab: string): string {
  const t = tab.replace(/["'׳״]/g, "").trim();
  const has = (s: string) => t.includes(s);
  if (/אדר\s*(א|1|ראשון)/.test(t)) return "אדר א";
  if (/אדר\s*(ב|2|שני)/.test(t)) return "אדר ב";
  if (has("אדר")) return "אדר";
  if (has("תשרי")) return "תשרי";
  if (has("חשו")) return "חשוון";
  if (has("כסל")) return "כסלו";
  if (has("טבת")) return "טבת";
  if (has("שבט")) return "שבט";
  if (has("ניסן")) return "ניסן";
  if (has("אייר")) return "אייר";
  if (has("סיו")) return "סיון";
  if (has("תמוז")) return "תמוז";
  if (has("אלול")) return "אלול";
  if (has("אב")) return "אב";
  return t;
}

/** Extract the Hebrew year (e.g. 5786) from a tab title like "…התשפו…". */
export function parseHebrewYear(title: string): number | null {
  const m = String(title).match(/ה(תש[א-ת]{1,3})/);
  if (!m) return null;
  const g = gematriaToInt(m[1]); // e.g. תשפו -> 786
  const year = 5000 + g;
  return year >= 5700 && year <= 5900 ? year : null;
}

export function parseHalachicWorkbook(wb: XLSX.WorkBook): ParsedHalachic {
  const sheetRows = (name: string) =>
    XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      raw: false,
    });

  // Year from the first tab's title.
  const firstRows = sheetRows(wb.SheetNames[0]);
  const hebrew_year = parseHebrewYear(String(firstRows[0]?.[0] ?? "")) ?? 0;

  const months: HalachicMonth[] = [];

  for (const name of wb.SheetNames) {
    const rows = sheetRows(name);
    const header = rows[1] ?? [];
    const isOldLayout = String(header[1] ?? "").trim() === "תא'"; // vs "יום עברי"

    // Precompute a label per column.
    const labelFor = (i: number): string => {
      if (isOldLayout) return OLD_LAYOUT_LABELS[i] ?? expandAbbrev(String(header[i] ?? ""));
      return expandAbbrev(String(header[i] ?? ""));
    };

    // Gregorian-day column (only in the new layout: header contains "לועזי").
    const gregCol = header.findIndex((h) => String(h ?? "").includes("לועזי"));

    // Which of columns A/B is the Hebrew day-of-month varies between tabs (the
    // other is the weekday). The day column runs 1..30 with DISTINCT values; the
    // weekday cycles 1..7 with repeats. Pick the column with more distinct days.
    const dataRowIdx: number[] = [];
    for (let r = 2; r < rows.length; r++) if ((rows[r] ?? []).some(isTime)) dataRowIdx.push(r);
    const distinctDays = (col: number) => {
      const s = new Set<number>();
      for (const r of dataRowIdx) {
        const v = gematriaToInt(rows[r]?.[col]);
        if (v >= 1 && v <= 30) s.add(v);
      }
      return s.size;
    };
    const dayCol = distinctDays(0) > distinctDays(1) ? 0 : 1;

    const days: HalachicDay[] = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if (!row.some(isTime)) continue; // only real day rows carry times
      const hebrew_day = gematriaToInt(row[dayCol]);
      if (hebrew_day < 1 || hebrew_day > 30) continue;

      const times: HalachicTimeEntry[] = [];
      for (let i = 0; i < row.length; i++) {
        if (!isTime(row[i])) continue;
        const label = labelFor(i);
        if (label) times.push({ label, time: String(row[i]).trim() });
      }

      const day_title = String(row[2] ?? "").trim() || null;
      const gd = gregCol >= 0 ? parseInt(String(row[gregCol] ?? ""), 10) : NaN;

      days.push({
        hebrew_day,
        day_title,
        gregorian_day: Number.isFinite(gd) ? gd : null,
        times,
      });
    }

    if (days.length > 0) months.push({ month_name: tabToCanonicalMonth(name), days });
  }

  return { hebrew_year, months };
}
