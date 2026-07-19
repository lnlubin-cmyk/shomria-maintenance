import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/email";

/**
 * Links a freshly authenticated account to its resident record, creating the
 * `users` row. Called after email OTP verification, and after Google SSO.
 *
 * Runs with the service role because RLS restricts writes to `users` to admins
 * — a user cannot create their own row. Every input is re-derived server-side:
 * the caller never supplies a role or resident id.
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

  // Trust the email verified on the auth account (email OTP and Google SSO both
  // set it). Fall back to the body only if somehow absent.
  const body = await request.json().catch(() => ({}));
  const candidate = authUser.email ?? body.email;

  if (typeof candidate !== "string") {
    return NextResponse.json({ error: "כתובת אימייל חסרה" }, { status: 400 });
  }

  const normalized = normalizeEmail(candidate);
  if (!normalized) {
    return NextResponse.json({ error: "כתובת האימייל אינה תקינה" }, { status: 400 });
  }

  const { data: resident } = await admin
    .from("residents")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (!resident) {
    return NextResponse.json(
      { error: "האימייל אינו רשום ברשימת התושבים. פנה למזכירות." },
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
    email: normalized,
    phone: authUser.phone ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "שגיאה ביצירת המשתמש" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
