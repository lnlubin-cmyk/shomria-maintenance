import { createAdminClient } from "@/lib/supabase/server";
import { sendSms019 } from "@/lib/sms019";
import { faultUrl } from "@/lib/site";
import type { FaultStatus } from "@/lib/types";

/** The automatic SMS sent to the resident when a call is opened. */
export const FAULT_RECEIVED_MESSAGE =
  "פנייתך לצוות חצר התקבלה במערכת\n" +
  "והועברה לטיפולו של צוות חצר\n" +
  "צוות חצר יעדכן על המשך הטיפול בפנייתך ויצור איתך קשר במידת הצורך";

/** Plain-Hebrew wording for each status, used in the automatic status SMS. */
const STATUS_SMS_TEXT: Record<FaultStatus, string> = {
  received: "התקלה התקבלה במערכת",
  in_treatment: "התקלה בטיפול",
  on_hold: "הטיפול בקריאה בהמתנה",
  fixed: "התקלה תוקנה",
  duplicate: "הקריאה סומנה ככפולה (קיימת כבר קריאה במערכת על תקלה זו)",
};

/** Automatic SMS sent to the caller when a call's status changes. Includes a
 *  link to the call page; the "fixed" message invites rating the handling. */
export async function sendFaultStatusSms(faultNumber: number, status: FaultStatus): Promise<{ ok: boolean }> {
  const link = faultUrl(faultNumber);
  const body =
    status === "fixed"
      ? `הקריאה שלך (#${faultNumber}) — התקלה תוקנה.\nלצפייה בפרטי הטיפול ולדירוג הטיפול:\n${link}`
      : `עודכן סטטוס הקריאה שלך (#${faultNumber}): ${STATUS_SMS_TEXT[status]}.\nלצפייה בפרטים:\n${link}`;
  return sendFaultSms(faultNumber, body, { automatic: true });
}

function statusOf(r: { ok: boolean; status?: number; message?: string }): string {
  return r.status !== undefined ? String(r.status) : (r.message ?? (r.ok ? "0" : "failed"));
}

/**
 * Send an SMS to a fault's caller and record it in fault_messages.
 *
 * The row is inserted BEFORE contacting the provider, so the message is never
 * lost — even if the SMS provider hangs and the serverless function is killed
 * before it returns. The delivery status is then updated in place.
 */
export async function sendFaultSms(
  faultNumber: number,
  body: string,
  opts: { automatic?: boolean; senderUserId?: string | null } = {}
): Promise<{ ok: boolean }> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("faults")
    .select("caller:residents!faults_caller_resident_id_fkey(phone)")
    .eq("fault_number", faultNumber)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phone = (data as any)?.caller?.phone as string | undefined;

  // 1. Log first (always saved).
  const { data: row } = await admin
    .from("fault_messages")
    .insert({
      fault_number: faultNumber,
      body,
      to_phone: phone ?? null,
      sms_ok: null,
      sms_status: phone ? "pending" : "no phone",
      is_automatic: !!opts.automatic,
      created_by_user_id: opts.senderUserId ?? null,
    })
    .select("id")
    .single();

  if (!phone) return { ok: false };

  // 2. Attempt delivery.
  const r = await sendSms019(phone, body);

  // 3. Record the result in place.
  if (row) {
    await admin
      .from("fault_messages")
      .update({ sms_ok: r.ok, sms_status: statusOf(r) })
      .eq("id", row.id);
  }
  return { ok: r.ok };
}

/** Re-send an existing (failed) message and update its delivery status. */
export async function resendFaultSms(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: msg } = await admin
    .from("fault_messages")
    .select("body, fault_number")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return { ok: false, error: "הודעה חסרה" };

  const { data: f } = await admin
    .from("faults")
    .select("caller:residents!faults_caller_resident_id_fkey(phone)")
    .eq("fault_number", msg.fault_number)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phone = (f as any)?.caller?.phone as string | undefined;
  if (!phone) {
    await admin.from("fault_messages").update({ sms_status: "no phone" }).eq("id", messageId);
    return { ok: false, error: "אין מספר טלפון לתושב" };
  }

  const r = await sendSms019(phone, msg.body);
  await admin
    .from("fault_messages")
    .update({ sms_ok: r.ok, sms_status: statusOf(r), to_phone: phone })
    .eq("id", messageId);
  return { ok: r.ok };
}
