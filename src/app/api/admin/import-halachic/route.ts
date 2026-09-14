import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { canEditReligious } from "@/lib/types";
import { parseHalachicWorkbook } from "@/lib/halachic-parse";

/**
 * Admin upload of the halachic-times Excel. The file may be a full year OR a
 * partial file (one/some months). Only the months present in the file are
 * replaced — other months already loaded for that year are kept — so a
 * single-month upload updates just that month instead of wiping the year. The
 * file is small (well under the serverless body limit), so a normal multipart
 * upload is fine.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  if (!canEditReligious(session.user.role)) {
    return NextResponse.json({ error: "אין לך הרשאה" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מ-10MB" }, { status: 400 });
  }

  let parsed;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    parsed = parseHalachicWorkbook(wb);
  } catch {
    return NextResponse.json(
      { error: "לא ניתן לקרוא את הקובץ. ודא שזהו קובץ Excel תקין." },
      { status: 400 }
    );
  }

  if (!parsed.hebrew_year) {
    return NextResponse.json(
      { error: "לא זוהתה שנה עברית בכותרת הקובץ (למשל „התשפ\"ו”)." },
      { status: 400 }
    );
  }
  const rows = parsed.months.flatMap((mo) =>
    mo.days.map((d) => ({
      hebrew_year: parsed.hebrew_year,
      month_name: mo.month_name,
      hebrew_day: d.hebrew_day,
      day_title: d.day_title,
      gregorian_day: d.gregorian_day,
      times: d.times,
    }))
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "לא נמצאו נתונים בקובץ" }, { status: 400 });
  }

  const monthNames = parsed.months.map((mo) => mo.month_name);
  const admin = createAdminClient();
  // Replace only the months that are in this file, leaving the rest of the
  // year's data intact — this is what makes a partial (single-month) upload work.
  await admin
    .from("halachic_times")
    .delete()
    .eq("hebrew_year", parsed.hebrew_year)
    .in("month_name", monthNames);
  const { error } = await admin.from("halachic_times").insert(rows);
  if (error) {
    return NextResponse.json({ error: "טעינת הקובץ נכשלה" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    year: parsed.hebrew_year,
    months: parsed.months.length,
    monthNames,
    days: rows.length,
  });
}
