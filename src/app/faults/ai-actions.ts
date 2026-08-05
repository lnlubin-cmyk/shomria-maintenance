"use server";

import { getSession, createAdminClient } from "@/lib/supabase/server";
import {
  isStaff,
  formatDate,
  STATUS_LABELS,
  TREATMENT_TYPE_LABELS,
  type FaultStatus,
  type TreatmentType,
} from "@/lib/types";
import { askAI, isAIConfigured, type AiMessage } from "@/lib/ai";

export type AdviceTurn = { role: "user" | "assistant"; text: string };

const INITIAL_ASK = "אנא סכם את היסטוריית התיקונים בבית, והמלץ כיצד לטפל בתקלה הנוכחית.";

const SYSTEM_INSTRUCTIONS =
  "אתה יועץ תחזוקה מנוסה לקהילת שומריה. בהתבסס על היסטוריית התיקונים של הבית ועל התקלה הנוכחית, " +
  "עליך: (1) לסכם בקצרה את התיקונים שבוצעו בבית ולהצביע על תקלות חוזרות או דפוסים; " +
  "(2) להמליץ על צעדים מעשיים לאבחון ולתיקון התקלה הנוכחית. " +
  "ענה בעברית, בצורה תמציתית וברורה, תחת הכותרות „סיכום היסטוריית התיקונים” ו„המלצה לטיפול”. " +
  "אם המידע חסר — אמור זאת במפורש ואל תמציא פרטים. " +
  "הדגש שעבודות חשמל, גז או בנייה מחייבות בעל מקצוע מוסמך. " +
  "ההמלצות הן עצה בלבד ואינן תחליף לשיקול דעת מקצועי.";

type HistoryRow = {
  fault_number: number;
  fault_description: string | null;
  treatment_description: string | null;
  treatment_type: TreatmentType | null;
  status: FaultStatus;
  created_at: string;
};

/**
 * AI advice for a call: gathers the house's technical repair history (resident
 * names are intentionally NOT sent) plus the current fault, and asks the
 * configured AI to summarise + recommend. Supports follow-up questions and an
 * optional (downscaled) photo. Nothing is stored — each call is fresh.
 */
export async function getFaultAdvice(input: {
  faultNumber: number;
  turns: AdviceTurn[];
  imageDataUrl?: string | null;
}): Promise<{ text: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };
  if (!isAIConfigured()) {
    return { error: "ייעוץ AI אינו מוגדר עדיין. יש להגדיר ספק AI ומפתח בהגדרות הסביבה ב-Vercel." };
  }

  const admin = createAdminClient();
  const { data: fault } = await admin
    .from("faults")
    .select("fault_number, building_plot_number, fault_description, treatment_type")
    .eq("fault_number", input.faultNumber)
    .maybeSingle();
  if (!fault) return { error: "הקריאה לא נמצאה" };

  const [{ data: history }, { data: facts }, { data: building }] = await Promise.all([
    admin
      .from("faults")
      .select("fault_number, fault_description, treatment_description, treatment_type, status, created_at")
      .eq("building_plot_number", fault.building_plot_number)
      .order("created_at"),
    admin.from("building_facts").select("key, value").eq("plot_number", fault.building_plot_number),
    admin
      .from("buildings")
      .select("water_heater_type")
      .eq("plot_number", fault.building_plot_number)
      .maybeSingle(),
  ]);

  // Build the technical context (no personal details).
  const lines: string[] = ["היסטוריית תיקונים בבית (ללא פרטים אישיים):"];
  const rows = (history ?? []) as HistoryRow[];
  if (rows.length === 0) {
    lines.push("- (אין תקלות קודמות מתועדות)");
  } else {
    for (const h of rows) {
      const parts = [`קריאה #${h.fault_number}`, formatDate(h.created_at)];
      parts.push(`תקלה: ${h.fault_description || "—"}`);
      if (h.treatment_type) parts.push(`סוג טיפול: ${TREATMENT_TYPE_LABELS[h.treatment_type] ?? h.treatment_type}`);
      if (h.treatment_description) parts.push(`טיפול שבוצע: ${h.treatment_description}`);
      parts.push(`סטטוס: ${STATUS_LABELS[h.status] ?? h.status}`);
      lines.push("- " + parts.join(" | "));
    }
  }
  if (building?.water_heater_type) lines.push(`סוג הדוד: ${building.water_heater_type}`);
  if ((facts ?? []).length) {
    lines.push("מידע טכני על הבית:");
    for (const f of facts as { key: string; value: string }[]) lines.push(`- ${f.key}: ${f.value}`);
  }
  lines.push("");
  lines.push(`התקלה הנוכחית לטיפול (קריאה #${fault.fault_number}): ${fault.fault_description || "—"}`);

  const system = `${SYSTEM_INSTRUCTIONS}\n\nנתוני הבית:\n${lines.join("\n")}`;

  // Turn the visible conversation into AI messages (always starting with a user
  // turn); attach the photo, if any, to the most recent user message.
  const turns = input.turns.length ? input.turns : [{ role: "user" as const, text: INITIAL_ASK }];
  const lastUserIdx = turns.map((t) => t.role).lastIndexOf("user");
  const messages: AiMessage[] = turns.map((t, i) => {
    if (t.role === "user" && i === lastUserIdx && input.imageDataUrl) {
      return {
        role: "user",
        content: [
          { type: "text", text: t.text },
          { type: "image", image: input.imageDataUrl },
        ],
      };
    }
    return { role: t.role, content: t.text };
  });

  try {
    const text = await askAI({ system, messages });
    return { text };
  } catch {
    return { error: "הפנייה למנוע ה-AI נכשלה. נסה שוב." };
  }
}
