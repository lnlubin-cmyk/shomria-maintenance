import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { sendSms019 } from "@/lib/sms019";

/**
 * Registration by SMS — step 1: send a code.
 *
 * Gated on the residents table: a code is generated and sent only if the phone
 * belongs to a resident who also has an email on file (login stays email +
 * password, so an email is required to finish). Deliberately returns the same
 * response either way, so an unauthenticated caller can't enumerate residents'
 * phone numbers or burn SMS credits on arbitrary numbers.
 */
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

function hashCode(code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

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

  const { data: resident } = await admin
    .from("residents")
    .select("id, email")
    .eq("phone", normalized)
    .maybeSingle();

  // Only send to a resident who can actually finish (needs an email to log in).
  if (resident?.email) {
    // Cooldown: don't resend within 30s of the last code.
    const { data: existing } = await admin
      .from("sms_otps")
      .select("created_at")
      .eq("phone", normalized)
      .maybeSingle();

    const recentlySent =
      existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_MS;

    if (!recentlySent) {
      const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
      await admin.from("sms_otps").upsert(
        {
          phone: normalized,
          code_hash: hashCode(code),
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
          attempts: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
      // Short Hebrew message = one UCS-2 segment.
      await sendSms019(normalized, `קוד כניסה לאתר שומריה: ${code}`);
    }
  }

  // Same response whether or not the number is a resident.
  return NextResponse.json({ ok: true });
}
