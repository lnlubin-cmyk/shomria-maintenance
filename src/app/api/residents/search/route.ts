import { NextResponse } from "next/server";
import { getSession, createAdminClient } from "@/lib/supabase/server";

/**
 * Resident name search for the "שם הפונה" field (spec, screen 2a) — a resident
 * may open a call on behalf of another resident, and must be able to find them
 * by first/last name. Free text that matches nobody is rejected by the form.
 *
 * Uses the service role because RLS lets a resident read only their own row.
 * Returns id and name ONLY — never phone numbers — so this cannot become a
 * directory dump of residents' contact details.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ residents: [] });
  }

  // Escape PostgREST's `or` filter metacharacters before interpolating.
  const safe = q.replace(/[%,()]/g, " ");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("residents")
    .select("id, first_name, last_name")
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`)
    .order("last_name")
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "שגיאת חיפוש" }, { status: 500 });
  }

  return NextResponse.json({ residents: data ?? [] });
}
