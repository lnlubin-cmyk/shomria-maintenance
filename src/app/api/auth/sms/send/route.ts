import { NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { sendSms019 } from "@/lib/sms019";

/**
 * Registration by SMS — step 1: send a code.
 *
 * Gated on the residents table: a code is generated and sent only if the phone
 * belongs to a resident. The response reports `eligible` so the UI can tell the
 * user their number isn't on the resident list (instead of leaving them waiting
 * for an SMS that never comes). This does let a caller probe whether a given
 * number is a resident; accepted here for usability in a small community.
 */
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;

// Daily caps (per calendar day, UTC) on top of the 30s per-phone cooldown.
//   PHONE_DAILY_CAP — actual codes sent to one number: bounds SMS cost and
//     blocks bombing one resident. Global (any source IP), so cost is capped at
//     (residents x cap) even under attack.
//   IP_MISS_CAP — *failed* probes (a number that isn't a resident) from one IP.
//     No SMS is sent for a miss, so the only harm is enumeration via `eligible`;
//     this caps how many numbers one IP can probe. Crucially it counts only
//     misses, so many residents behind one shared/CGNAT IP (the launch-day case)
//     never trip it — their logins are hits.
const PHONE_DAILY_CAP = 8;
const IP_MISS_CAP = 25;

function hashCode(code: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  return fwd.split(",")[0].trim() || "unknown";
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

  // `bump_sms_rate` atomically increments the day counter for a bucket and
  // returns the new value; it fails open (returns 0 on error) so a transient DB
  // issue can't lock everyone out.
  const day = new Date().toISOString().slice(0, 10);
  const bump = async (bucket: string): Promise<number> => {
    const { data, error } = await admin.rpc("bump_sms_rate", { p_bucket: bucket, p_day: day });
    return error ? 0 : Number(data ?? 0);
  };

  const { data: resident } = await admin
    .from("residents")
    .select("id")
    .eq("phone", normalized)
    .maybeSingle();

  if (!resident) {
    // Miss: no SMS is sent, so the only concern is enumeration. Count misses
    // per IP and cut off a sweep. Legitimate residents are hits and never land
    // here, so a shared/CGNAT IP with many real logins isn't affected.
    const misses = await bump(`ipmiss:${clientIp(request)}`);
    if (misses > IP_MISS_CAP) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב מאוחר יותר." }, { status: 429 });
    }
    return NextResponse.json({ ok: true, eligible: false });
  }

  // Hit: send to this resident. Cooldown: don't resend within 30s of the last code.
  const { data: existing } = await admin
    .from("sms_otps")
    .select("created_at")
    .eq("phone", normalized)
    .maybeSingle();

  const recentlySent =
    existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_MS;

  if (!recentlySent) {
    // Per-phone daily cap on codes actually sent — bounds cost and bombing.
    const sends = await bump(`phone:${normalized}`);
    if (sends > PHONE_DAILY_CAP) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב מאוחר יותר." }, { status: 429 });
    }
    const code = String(randomInt(100000, 1000000)); // 6 digits, CSPRNG
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

  // `eligible` lets the UI show a clear "not on the resident list" message.
  return NextResponse.json({ ok: true, eligible: true });
}
