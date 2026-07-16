import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";

/**
 * Links a freshly authenticated account to its resident record, creating the
 * `users` row. Called after phone OTP verification, and after SSO once the
 * user supplies a phone number.
 *
 * Runs with the service role because RLS restricts writes to `users` to admins
 * — a user cannot create their own row. Every input is re-derived server-side:
 * the caller supplies only a phone, never a role or resident id.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "לא מחובר" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Already linked — nothing to do.
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyLinked: true });
  }

  // Prefer the verified phone on the auth account (OTP flow). For SSO the auth
  // account has no phone, so fall back to what the user typed.
  const body = await request.json().catch(() => ({}));
  const candidate = authUser.phone ?? body.phone;

  if (typeof candidate !== "string") {
    return NextResponse.json({ error: "מספר טלפון חסר" }, { status: 400 });
  }

  const normalized = normalizeIsraeliPhone(candidate);
  if (!normalized) {
    return NextResponse.json({ error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }

  const { data: resident } = await admin
    .from("residents")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle();

  if (!resident) {
    return NextResponse.json(
      { error: "מספר הטלפון אינו רשום ברשימת התושבים. פנה למזכירות." },
      { status: 403 }
    );
  }

  // One account per resident.
  const { data: taken } = await admin
    .from("users")
    .select("id")
    .eq("resident_id", resident.id)
    .maybeSingle();

  if (taken) {
    return NextResponse.json(
      { error: "לתושב זה כבר קיים חשבון במערכת. פנה למזכירות." },
      { status: 409 }
    );
  }

  // Role is always 'resident' here. Elevating to maintenance/admin is an
  // admin-screen action — never something a signing-in user can request.
  const { error } = await admin.from("users").insert({
    id: authUser.id,
    resident_id: resident.id,
    role: "resident",
    email: authUser.email ?? null,
    phone: normalized,
  });

  if (error) {
    return NextResponse.json({ error: "שגיאה ביצירת המשתמש" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
