import { z } from "zod";
import { isAIConfigured, askAIObject, type AiMessage } from "@/lib/ai";

/**
 * A section the AI proposes cutting from the newsletter. Coordinates are
 * normalized 0..1 relative to that page's frame-free preview image (the same
 * image the admin sees and adjusts), so they map straight onto the crop tool.
 */
export interface SectionSuggestion {
  page: number; // 0-based page index
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  title: string;
  // "clinic" is a special target: publishing it updates the מרפאה info-panel.
  section: "community" | "info" | "torah" | "clinic";
}

const box = {
  page: z.number().int().describe("0-based page index, exactly as labeled"),
  x0: z.number().describe("left edge, 0..1 of page width"),
  y0: z.number().describe("top edge, 0..1 of page height"),
  x1: z.number().describe("right edge, 0..1 of page width"),
  y1: z.number().describe("bottom edge, 0..1 of page height"),
};

const schema = z.object({
  sections: z.array(
    z.object({
      ...box,
      title: z.string().describe("short Hebrew heading for the section"),
      section: z.enum(["community", "info", "torah", "clinic"]),
    })
  ),
  // A dedicated, REQUIRED slot so the model must actively decide about the
  // upcoming-events calendar instead of overlooking it among many sections.
  eventsCalendar: z
    .object(box)
    .nullable()
    .describe("the upcoming-events weekday-grid calendar, or null if this week's newsletter has none"),
});

const SYSTEM = `אתה עוזר שמנתח ידיעון קהילתי שבועי (בעברית) ומזהה את המקטעים (סעיפים) שבו.
כל עמוד מחולק לרוב לכמה מקטעים, המופרדים בקווים מקווקווים או בכותרות מודגשות.
עבור כל מקטע החזר תיבה תוחמת (bounding box) בקואורדינטות מנורמלות 0..1 ביחס לתמונת העמוד שהוצגה לך (x מהשמאל, y מלמעלה), כותרת קצרה בעברית, ומדור מוצע:
- "clinic" = מקטע עדכוני המרפאה (למשל: „עדכוני מרפאה כללית”, שעות פתיחת המרפאה, ימי/שעות רופא ואחות). זהו מקטע מיוחד המשמש לעדכון פריט „מרפאה” בתפריט.
- "community" = הודעות והתרחשויות קהילתיות (אירועים, מזל טוב, הודעות אישיות, מכתבי מזכירות).
- "info" = מידע שימושי אחר לתושב (למשל: שעות ספריה, רשימות שמירה, דרושים).
- "torah" = תורה ותפילה (זמני תפילות, שיעורי תורה, ענייני קדושה).

מקטע המרפאה: אם קיים מקטע עדכוני מרפאה — החזר אותו עם section="clinic".

לוח האירועים הקרובים (חובה לבדוק בכל עמוד!): עליך למלא את השדה eventsCalendar.
זהו לוח/רשת שמסכם את האירועים של השבוע-שבועיים הקרובים. כך מזהים אותו:
- כותרת, לרוב בכתב-יד מעוצב בתוך תמונה, בנוסח „אז מה קורה פה בע״ה בקרוב” / „אז מה קורה פה בעז״ה בזמן הקרוב” / „מה קורה פה” / „בזמן הקרוב”.
- מתחת לכותרת: רשת/טבלה עם שמות ימות השבוע (ראשון, שני, שלישי, רביעי, חמישי, שישי, שבת) ובכל תא תאריך עברי (למשל „י׳ אלול”) ולעיתים שם אירוע.
- לרוב פרושה על שורה או שתיים (שבוע-שבועיים), נמצאת בתחתית עמוד, ולעיתים קרובות היא חלק מתמונה/פלייר — סרוק גם עמודים שהם בעיקר תמונה.
סרוק בעיון את החלק התחתון של כל עמוד. אם מצאת לוח כזה — החזר את התיבה התוחמת שלו (כולל הכותרת) בשדה eventsCalendar. אם באמת אין לוח כזה בשום עמוד — החזר eventsCalendar=null. אל תכלול את לוח האירועים בתוך רשימת sections (הוא מוחזר בנפרד).

אל תמציא מקטעים שאינם קיימים.

כללי חשוב:
- הקף את המקטע בצמוד ככל האפשר לתוכן שלו.
- אל תכלול קישוטים או מסגרות.
- דלג על מקטעים ריקים.
- ודא ש-0 ≤ x0 < x1 ≤ 1 ו-0 ≤ y0 < y1 ≤ 1.`;

/**
 * Ask the AI to propose section boxes for the given page previews. Returns an
 * empty list when AI isn't configured or the call fails — the admin can then add
 * boxes manually, so the feature still works without a key.
 */
export async function suggestSections(pages: { index: number; jpeg: Uint8Array }[]): Promise<SectionSuggestion[]> {
  if (!isAIConfigured() || pages.length === 0) return [];

  type Part =
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array; providerOptions?: Record<string, Record<string, unknown>> };
  const content: Part[] = [
    { type: "text", text: "להלן עמודי הידיעון, כל אחד עם מספר העמוד שלו. זהה את המקטעים בכל עמוד." },
  ];
  for (const p of pages) {
    content.push({ type: "text", text: `עמוד ${p.index}:` });
    // imageDetail:"high" → OpenAI reads the page at full resolution instead of a
    // downscaled version, so small/stylized Hebrew (e.g. the events calendar) is
    // legible. The `openai` namespace is ignored by other providers.
    content.push({ type: "image", image: p.jpeg, providerOptions: { openai: { imageDetail: "high" } } });
  }
  const messages = [{ role: "user", content }] as unknown as AiMessage[];

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  try {
    const obj = await askAIObject({ system: SYSTEM, messages, schema, maxTokens: 3000 });
    const out: SectionSuggestion[] = obj.sections
      .filter((s) => s.x1 > s.x0 && s.y1 > s.y0 && s.title.trim() !== "")
      .map((s) => ({
        page: s.page,
        x0: clamp(s.x0),
        y0: clamp(s.y0),
        x1: clamp(s.x1),
        y1: clamp(s.y1),
        title: s.title.trim(),
        section: s.section,
      }));

    // The events calendar comes back in its own field; add it as a קהילה section.
    const e = obj.eventsCalendar;
    if (e && e.x1 > e.x0 && e.y1 > e.y0) {
      out.push({
        page: e.page,
        x0: clamp(e.x0),
        y0: clamp(e.y0),
        x1: clamp(e.x1),
        y1: clamp(e.y1),
        title: "לוח אירועים",
        section: "community",
      });
    }
    return out;
  } catch {
    return [];
  }
}
