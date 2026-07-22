/**
 * 019 SMS sending. Verified contract:
 *   POST https://019sms.co.il/api  (…/api/test validates without sending)
 *   Authorization: Bearer <token>
 *   { sms: { user: { username }, source, destinations: { phone: ["05…"] }, message } }
 *   success => { status: 0 }
 */

const API = "https://019sms.co.il/api";

/** 019 wants a local Israeli number ("05xxxxxxx"); our DB stores E.164. */
export function toLocalIsraeliPhone(input: string): string {
  const d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+972")) return "0" + d.slice(4);
  if (d.startsWith("972")) return "0" + d.slice(3);
  if (d.startsWith("0")) return d;
  return "0" + d;
}

export interface Sms019Result {
  ok: boolean;
  status?: number;
  message?: string;
}

export async function sendSms019(
  phone: string,
  message: string,
  opts: { test?: boolean } = {}
): Promise<Sms019Result> {
  const token = process.env.SMS019_API_TOKEN;
  const username = process.env.SMS019_USERNAME;
  const source = process.env.SMS019_SENDER;
  if (!token || !username || !source) {
    return { ok: false, message: "SMS019 env not configured" };
  }

  const body = {
    sms: {
      user: { username },
      source,
      destinations: { phone: [toLocalIsraeliPhone(phone)] },
      message,
    },
  };

  try {
    const res = await fetch(API + (opts.test ? "/test" : ""), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
    return { ok: data?.status === 0, status: data?.status, message: data?.message };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
