import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession, createAdminClient } from "@/lib/supabase/server";

interface RowError {
  row: number;
  message: string;
}

/**
 * Bulk house (building) import from Excel. Column order is fixed and read
 * positionally, not by header name:
 *   1. שם המבנה (required)
 *   2. שכבה     (required — layer name, e.g. "בתים" / "מבני ציבור", or its id)
 *   3-6. תושב 1..4 (optional — resident IDs / תעודת זהות)
 *
 * The plot number (מגרש) is NOT in the file — the DB assigns it from a sequence
 * (migration 0010), so every valid row is inserted as a new house with a
 * system-assigned id. Re-uploading the same file therefore ADDS houses again;
 * it does not update existing ones (there is no natural key to match on).
 *
 * The whole file is validated first and rejected if any row is bad, so a
 * partial, confusing import never lands.
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
    // raw:false → cells as text, so a resident תעודת זהות with a leading zero
    // isn't silently turned into a number that no longer matches.
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: false });
  } catch {
    return NextResponse.json(
      { error: "לא ניתן לקרוא את הקובץ. ודא שזהו קובץ Excel תקין." },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "הקובץ ריק" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Layer lookup: accept the layer's name (case-insensitive) or its numeric id.
  const { data: layerRows, error: layerErr } = await admin
    .from("building_layers")
    .select("id, name");
  if (layerErr || !layerRows) {
    return NextResponse.json({ error: "טעינת השכבות נכשלה" }, { status: 500 });
  }
  const layerByName = new Map(layerRows.map((l) => [l.name.trim().toLowerCase(), l.id]));
  const layerById = new Set(layerRows.map((l) => l.id));
  const layerNames = layerRows.map((l) => l.name).join(", ");

  const cell = (r: unknown[], i: number) => String(r[i] ?? "").trim();

  // Skip a header row: if the first cell doesn't name a known layer in column 2,
  // and column 1 looks like a header word, treat row 0 as headers. Simpler and
  // safe: if row 0's column-2 value isn't a valid layer, it's a header.
  const firstLayerCell = cell(rows[0] ?? [], 1).toLowerCase();
  const firstIsData = layerByName.has(firstLayerCell) || layerById.has(Number(firstLayerCell));
  const dataRows = firstIsData ? rows : rows.slice(1);
  const rowOffset = firstIsData ? 1 : 2; // for human-readable row numbers

  const parsed: {
    building_name: string;
    layer_id: number;
    resident_1: string | null;
    resident_2: string | null;
    resident_3: string | null;
    resident_4: string | null;
  }[] = [];
  const errors: RowError[] = [];
  const residentIdsToCheck = new Set<string>();

  dataRows.forEach((row, i) => {
    const rowNumber = i + rowOffset;

    const name = cell(row, 0);
    const layerRaw = cell(row, 1);
    const residentCells = [cell(row, 2), cell(row, 3), cell(row, 4), cell(row, 5)];

    if (!name && !layerRaw && residentCells.every((c) => !c)) return; // blank row

    if (!name) {
      errors.push({ row: rowNumber, message: "שם המבנה חסר" });
      return;
    }

    let layerId: number | undefined = layerByName.get(layerRaw.toLowerCase());
    if (layerId === undefined && layerById.has(Number(layerRaw))) {
      layerId = Number(layerRaw);
    }
    if (layerId === undefined) {
      errors.push({
        row: rowNumber,
        message: `שכבה לא מוכרת: "${layerRaw}". שכבות אפשריות: ${layerNames}`,
      });
      return;
    }

    // Up to 4 optional resident IDs; validated for existence in a second pass.
    const residents: (string | null)[] = [null, null, null, null];
    const usedInRow = new Set<string>();
    let bad = false;
    residentCells.forEach((rid, idx) => {
      if (!rid) return;
      if (usedInRow.has(rid)) {
        errors.push({ row: rowNumber, message: `תושב כפול באותה שורה: ${rid}` });
        bad = true;
        return;
      }
      usedInRow.add(rid);
      residents[idx] = rid;
      residentIdsToCheck.add(rid);
    });
    if (bad) return;

    parsed.push({
      building_name: name,
      layer_id: layerId,
      resident_1: residents[0],
      resident_2: residents[1],
      resident_3: residents[2],
      resident_4: residents[3],
    });
  });

  // Validate referenced resident IDs actually exist (FK would fail anyway, but a
  // clear per-file message beats a generic 23503).
  if (residentIdsToCheck.size > 0) {
    const { data: existing } = await admin
      .from("residents")
      .select("id")
      .in("id", [...residentIdsToCheck]);
    const known = new Set((existing ?? []).map((r) => r.id));
    const missing = [...residentIdsToCheck].filter((id) => !known.has(id));
    if (missing.length > 0) {
      errors.push({
        row: 0,
        message: `תעודות זהות שאינן קיימות ברשימת התושבים: ${missing.slice(0, 15).join(", ")}`,
      });
    }
  }

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

  // Insert (not upsert): plot_number is omitted so the DB sequence assigns it.
  const { error } = await admin.from("buildings").insert(parsed);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "אחת מתעודות הזהות בקובץ אינה קיימת ברשימת התושבים." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "טעינת הקובץ נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported: parsed.length });
}
