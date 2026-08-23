"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { CAMPAIGN_BUCKET } from "@/lib/campaigns";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/"); // the home page shows the active campaign
}

/** Normalize an optional link: internal "/…" is kept; a bare domain gets https://. */
function normalizeLink(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // A same-origin internal path — but reject "//host" / "/\host" which browsers
  // treat as protocol-relative and would navigate off-site.
  if (/^\/(?![/\\])/.test(s)) return s;
  if (s.startsWith("/")) return null; // "//…" or "/\…" — not a valid internal link
  if (/^https?:\/\//i.test(s)) return s; // external URL
  return `https://${s}`; // bare domain → external
}

/** Signed URL so the browser uploads the poster directly to Storage. */
export async function createCampaignUpload(
  fileName: string,
  contentType: string
): Promise<{ path: string; token: string } | { error: string }> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!contentType.startsWith("image/")) return { error: "יש להעלות קובץ תמונה בלבד" };

  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "jpg";
  const path = `${randomUUID()}.${ext}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(CAMPAIGN_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "יצירת קישור ההעלאה נכשלה" };
  return { path: data.path, token: data.token };
}

/** Record a new campaign (inactive by default — activate it explicitly). */
export async function createCampaign(
  path: string,
  fileName: string,
  title: string,
  linkUrl: string,
  frequency: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!path) return { error: "חסרה תמונה לקמפיין" };

  const admin = createAdminClient();
  const { error } = await admin.from("campaigns").insert({
    title: (title ?? "").trim(),
    file_path: path,
    file_name: fileName,
    link_url: normalizeLink(linkUrl),
    frequency: frequency === "daily" ? "daily" : "once",
    is_active: false,
  });
  if (error) {
    await admin.storage.from(CAMPAIGN_BUCKET).remove([path]);
    return { error: "שמירת הקמפיין נכשלה" };
  }
  revalidate();
  return { ok: true };
}

/** Update a campaign's title, link and display frequency. */
export async function updateCampaign(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "קמפיין חסר" };
  const title = String(formData.get("title") ?? "").trim();
  const linkUrl = normalizeLink(String(formData.get("link_url") ?? ""));
  const frequency = String(formData.get("frequency") ?? "") === "daily" ? "daily" : "once";

  const admin = createAdminClient();
  const { error } = await admin
    .from("campaigns")
    .update({ title, link_url: linkUrl, frequency })
    .eq("id", id);
  if (error) return { error: "עדכון הקמפיין נכשל" };
  revalidate();
  return { ok: true };
}

/** Activate/deactivate. Activating one deactivates all the others. */
export async function setCampaignActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "קמפיין חסר" };
  const admin = createAdminClient();
  if (active) {
    await admin.from("campaigns").update({ is_active: false }).neq("id", id);
  }
  const { error } = await admin.from("campaigns").update({ is_active: active }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };
  revalidate();
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "קמפיין חסר" };
  const admin = createAdminClient();
  const { data: row } = await admin.from("campaigns").select("file_path").eq("id", id).maybeSingle();
  const { error } = await admin.from("campaigns").delete().eq("id", id);
  if (error) return { error: "מחיקת הקמפיין נכשלה" };
  if (row?.file_path) await admin.storage.from(CAMPAIGN_BUCKET).remove([row.file_path]);
  revalidate();
  return { ok: true };
}
