import { createAdminClient } from "@/lib/supabase/server";
import { sendSms019 } from "@/lib/sms019";

/** The automatic SMS sent to the resident when a call is opened. */
export const FAULT_RECEIVED_MESSAGE =
  "פנייתך לצוות חצר התקבלה במערכת\n" +
  "והועברה לטיפולו של צוות חצר\n" +
  "צוות חצר יעדכן על המשך הטיפול בפנייתך ויצור איתך קשר במידת הצורך";

/**
 * Send an SMS to a fault's caller and record it in fault_messages (always logged,
 * even if the SMS itself fails — the delivery status is stored on the row).
 * Uses the service-role client so it works from the resident's own creation flow.
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

  let smsOk = false;
  let smsStatus: string | null = "no phone";
  if (phone) {
    const r = await sendSms019(phone, body);
    smsOk = r.ok;
    smsStatus = r.status !== undefined ? String(r.status) : (r.message ?? (r.ok ? "0" : "failed"));
  }

  await admin.from("fault_messages").insert({
    fault_number: faultNumber,
    body,
    to_phone: phone ?? null,
    sms_ok: smsOk,
    sms_status: smsStatus,
    is_automatic: !!opts.automatic,
    created_by_user_id: opts.senderUserId ?? null,
  });

  return { ok: smsOk };
}
