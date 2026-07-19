import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/email";

/**
 * Only residents of the kibbutz may register. Checks the email against the
 * residents table before any OTP is sent.
 *
 * Deliberately does NOT reveal whether the email exists — an unauthenticated
 * caller could otherwise enumerate residents' addresses. The client shows the
 * same message either way; a real code is only sent when the email matches.
 */
export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({ email: null }));

  if (typeof email !== "string") {
    return NextResponse.json({ error: "כתובת אימייל חסרה" }, { status: 400 });
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return NextResponse.json({ error: "כתובת האימייל אינה תקינה" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("residents")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "שגיאת מערכת. נסה שוב." }, { status: 500 });
  }

  return NextResponse.json({ registered: Boolean(data), email: normalized });
}
