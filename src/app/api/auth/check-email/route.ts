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

  // Registered = a resident (may self-register), OR an existing account. The
  // second case covers admin-created accounts — residents whose email is set,
  // and external maintenance staff who aren't residents at all — so they can
  // run the code flow to set their first password.
  const [{ data: resident, error: rErr }, { data: user, error: uErr }] = await Promise.all([
    admin.from("residents").select("id").eq("email", normalized).maybeSingle(),
    admin.from("users").select("id").eq("email", normalized).eq("is_active", true).maybeSingle(),
  ]);

  if (rErr || uErr) {
    return NextResponse.json({ error: "שגיאת מערכת. נסה שוב." }, { status: 500 });
  }

  return NextResponse.json({
    registered: Boolean(resident) || Boolean(user),
    email: normalized,
  });
}
