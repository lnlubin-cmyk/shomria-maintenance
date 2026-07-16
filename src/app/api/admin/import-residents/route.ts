import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";

interface RowError {
  row: number;
  message: string;
}

/**
 * Spec screen 4: bulk resident import from Excel. Column order is fixed by the
 * spec and read positionally, not by header name:
 *   1. תעודת זהות  2. שם פרטי  3. שם משפחה  4. מספר טלפון
 *
 * Rows are validated first and the whole file is rejected if any row is bad —
 * a half-imported residents table is worse than none, since it is the
 * allowlist that decides who can register.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "אין לך הרשאת אדמין" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מ-5MB" }, { status: 400 });
  }

  let rows: unknown[][];
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return NextResponse.json({ error: "הקובץ אינו מכיל גיליון" }, { status: 400 });
    }
    // raw: false formats cells as text. Without it a תעודת זהות with a leading
    // zero arrives as the number 12345678 and loses it, so the resident could
    // never be matched at sign-in.
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
  } catch {
    return NextResponse.json({ error: "לא ניתן לקרוא את הקובץ. ודא שזהו קובץ Excel תקין." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "הקובץ ריק" }, { status: 400 });
  }

  // Skip a header row if the first cell is not a number-like ID.
  const first = String(rows[0]?.[0] ?? "").trim();
  const dataRows = /^\d+$/.test(first) ? rows : rows.slice(1);

  const cell = (r: unknown[], i: number) => String(r[i] ?? "").trim();

  const parsed: { id: string; first_name: string; last_name: string; phone: string }[] = [];
  const errors: RowError[] = [];
  const seenIds = new Set<string>();
  const seenPhones = new Set<string>();

  dataRows.forEach((row, i) => {
    // +1 for the header we skipped, +1 because spreadsheets are 1-indexed.
    const rowNumber = i + (dataRows === rows ? 1 : 2);

    const id = cell(row, 0);
    const firstName = cell(row, 1);
    const lastName = cell(row, 2);
    const phoneRaw = cell(row, 3);

    if (!id && !firstName && !lastName && !phoneRaw) return; // blank row

    if (!id) {
      errors.push({ row: rowNumber, message: "תעודת זהות חסרה" });
      return;
    }
    if (!firstName) {
      errors.push({ row: rowNumber, message: "שם פרטי חסר" });
      return;
    }
    if (!lastName) {
      errors.push({ row: rowNumber, message: "שם משפחה חסר" });
      return;
    }

    const phone = normalizeIsraeliPhone(phoneRaw);
    if (!phone) {
      errors.push({ row: rowNumber, message: `מספר טלפון אינו תקין: "${phoneRaw}"` });
      return;
    }

    if (seenIds.has(id)) {
      errors.push({ row: rowNumber, message: `תעודת זהות כפולה בקובץ: ${id}` });
      return;
    }
    if (seenPhones.has(phone)) {
      errors.push({ row: rowNumber, message: `מספר טלפון כפול בקובץ: ${phoneRaw}` });
      return;
    }

    seenIds.add(id);
    seenPhones.add(phone);
    parsed.push({ id, first_name: firstName, last_name: lastName, phone });
  });

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "הקובץ לא נטען. תקן את השגיאות ונסה שוב.",
        errors: errors.slice(0, 50),
        totalErrors: errors.length,
      },
      { status: 400 }
    );
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "לא נמצאו שורות תקינות בקובץ" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("residents").upsert(parsed, { onConflict: "id" });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "אחד ממספרי הטלפון בקובץ כבר רשום לתושב אחר במערכת." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "טעינת הקובץ נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: parsed.length });
}
