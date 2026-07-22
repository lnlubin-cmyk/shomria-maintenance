import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";

/**
 * Registration by SMS — step 2: verify the code.
 *
 * On success the resident is proven to own the phone. We then ensure a Supabase
 * account exists on the resident's EMAIL (login stays email + password) and a
 * users row, and hand back a magic-link token the client verifies to establish
 * a session — after which it sets a password (same as the email path).
 */
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const phone = typeof body.phone === "string" ? normalizeIsraeliPhone(body.phone) : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!phone || !code) {
    return NextResponse.json({ error: "פרטים חסרים" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: otp } = await admin
    .from("sms_otps")
    .select("code_hash, expires_at, attempts")
    .eq("phone", phone)
    .maybeSingle();

  if (!otp) {
    return NextResponse.json({ error: "הקוד שגוי או פג תוקף." }, { status: 400 });
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    await admin.from("sms_otps").delete().eq("phone", phone);
    return NextResponse.json({ error: "הקוד פג תוקף. בקש קוד חדש." }, { status: 400 });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await admin.from("sms_otps").delete().eq("phone", phone);
    return NextResponse.json({ error: "יותר מדי ניסיונות. בקש קוד חדש." }, { status: 429 });
  }
  if (otp.code_hash !== hashCode(code)) {
    await admin.from("sms_otps").update({ attempts: otp.attempts + 1 }).eq("phone", phone);
    return NextResponse.json({ error: "הקוד שגוי." }, { status: 400 });
  }

  // Correct — consume the code.
  await admin.from("sms_otps").delete().eq("phone", phone);

  const { data: resident } = await admin
    .from("residents")
    .select("id, email, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (!resident) {
    return NextResponse.json({ error: "מספר הטלפון אינו רשום ברשימת התושבים." }, { status: 403 });
  }
  if (!resident.email) {
    return NextResponse.json(
      { error: "לתושב זה אין אימייל במערכת, ולכן לא ניתן להשלים רישום. פנה למזכירות." },
      { status: 409 }
    );
  }

  // Ensure an account (on the resident's email) and a users row exist.
  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("resident_id", resident.id)
    .maybeSingle();

  if (!existingUser) {
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: resident.email,
      phone: resident.phone,
      email_confirm: true,
      phone_confirm: true,
    });
    if (authErr || !created.user) {
      return NextResponse.json({ error: "יצירת החשבון נכשלה." }, { status: 500 });
    }
    const { error: insErr } = await admin.from("users").insert({
      id: created.user.id,
      resident_id: resident.id,
      role: "resident",
      email: resident.email,
      phone: resident.phone,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: "יצירת המשתמש נכשלה." }, { status: 500 });
    }
  }

  // Hand back a one-time token the client verifies to get a session.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: resident.email,
  });
  if (linkErr || !link.properties?.hashed_token) {
    return NextResponse.json({ error: "יצירת ההתחברות נכשלה." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tokenHash: link.properties.hashed_token });
}
