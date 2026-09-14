import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { getHalachicMonth } from "@/lib/halachic";

/** Days + times for one loaded month, for the halachic-times month viewer. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = searchParams.get("month") ?? "";
  if (!year || !month) return NextResponse.json({ error: "פרמטרים חסרים" }, { status: 400 });

  const days = await getHalachicMonth(year, month);
  return NextResponse.json({ days });
}
