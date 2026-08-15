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
  section: "community" | "info" | "torah";
}

const schema = z.object({
  sections: z.array(
    z.object({
      page: z.number().int().describe("0-based page index, exactly as labeled"),
      x0: z.number().describe("left edge, 0..1 of page width"),
      y0: z.number().describe("top edge, 0..1 of page height"),
      x1: z.number().describe("right edge, 0..1 of page width"),
      y1: z.number().describe("bottom edge, 0..1 of page height"),
      title: z.string().describe("short Hebrew heading for the section"),
      section: z.enum(["community", "info", "torah"]),
    })
  ),
});

const SYSTEM = `אתה עוזר שמנתח ידיעון קהילתי שבועי (בעברית) ומזהה את המקטעים (סעיפים) שבו.
כל עמוד מחולק לרוב לכמה מקטעים, המופרדים בקווים מקווקווים או בכותרות מודגשות.
עבור כל מקטע החזר תיבה תוחמת (bounding box) בקואורדינטות מנורמלות 0..1 ביחס לתמונת העמוד שהוצגה לך (x מהשמאל, y מלמעלה), כותרת קצרה בעברית, ומדור מוצע:
- "info" = מידע שימושי לתושב (למשל: שעות מרפאה, שעות ספריה, רשימות שמירה, דרושים, לוח אירועים).
- "torah" = תורה ותפילה (זמני תפילות, שיעורי תורה, ענייני קדושה).
- "community" = הודעות והתרחשויות קהילתיות (אירועים, מזל טוב, הודעות אישיות, מכתבי מזכירות).
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

  const content: Array<{ type: "text"; text: string } | { type: "image"; image: Uint8Array }> = [
    { type: "text", text: "להלן עמודי הידיעון, כל אחד עם מספר העמוד שלו. זהה את המקטעים בכל עמוד." },
  ];
  for (const p of pages) {
    content.push({ type: "text", text: `עמוד ${p.index}:` });
    content.push({ type: "image", image: p.jpeg });
  }
  const messages: AiMessage[] = [{ role: "user", content }];

  try {
    const obj = await askAIObject({ system: SYSTEM, messages, schema, maxTokens: 3000 });
    return obj.sections
      .filter((s) => s.x1 > s.x0 && s.y1 > s.y0 && s.title.trim() !== "")
      .map((s) => ({
        page: s.page,
        x0: Math.max(0, Math.min(1, s.x0)),
        y0: Math.max(0, Math.min(1, s.y0)),
        x1: Math.max(0, Math.min(1, s.x1)),
        y1: Math.max(0, Math.min(1, s.y1)),
        title: s.title.trim(),
        section: s.section,
      }));
  } catch {
    return [];
  }
}
