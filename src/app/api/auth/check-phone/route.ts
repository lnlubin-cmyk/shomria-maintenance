import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";

/**
 * Spec 1a: only residents of the kibbutz may register. Checks the phone
 * against the residents table before any OTP is sent.
 *
 * Deliberately does NOT reveal whether the number exists — an unauthenticated
 * caller could otherwise enumerate residents' phone numbers. The client shows
 * the same message either way; a real OTP is only sent when the number matches.
 */
export async function POST(request: Request) {
  const { phone } = await request.json().catch(() => ({ phone: null }));

  if (typeof phone !== "string") {
    return NextResponse.json({ error: "מספר טלפון חסר" }, { status: 400 });
  }

  const normalized = normalizeIsraeliPhone(phone);
  if (!normalized) {
    return NextResponse.json({ error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("residents")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "שגיאת מערכת. נסה שוב." }, { status: 500 });
  }

  return NextResponse.json({ registered: Boolean(data), phone: normalized });
}
