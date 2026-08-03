"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { ok: true };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/contact");
}

export async function createContact(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "יש להזין שם ליחידה" };

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from("contacts")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await admin.from("contacts").insert({ name, email, phone, sort_order });
  if (error) return { error: "יצירת איש הקשר נכשלה" };

  revalidate();
  return { ok: true };
}

export async function updateContact(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!id) return { error: "איש קשר חסר" };
  if (!name) return { error: "יש להזין שם ליחידה" };

  const admin = createAdminClient();
  const { error } = await admin.from("contacts").update({ name, email, phone }).eq("id", id);
  if (error) return { error: "עדכון איש הקשר נכשל" };

  revalidate();
  return { ok: true };
}

export async function toggleContactVisible(id: string, visible: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "איש קשר חסר" };
  const admin = createAdminClient();
  const { error } = await admin.from("contacts").update({ is_visible: visible }).eq("id", id);
  if (error) return { error: "עדכון הסטטוס נכשל" };
  revalidate();
  return { ok: true };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "איש קשר חסר" };
  const admin = createAdminClient();
  const { error } = await admin.from("contacts").delete().eq("id", id);
  if (error) return { error: "מחיקת איש הקשר נכשלה" };
  revalidate();
  return { ok: true };
}

/** Reorder (up/down) — normalizes sort_order across all contacts. */
export async function moveContact(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("contacts")
    .select("id")
    .order("sort_order")
    .order("created_at");
  const order = (rows ?? []).map((r) => r.id);
  const idx = order.indexOf(id);
  if (idx < 0) return { error: "איש קשר חסר" };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= order.length) return { ok: true };
  [order[idx], order[target]] = [order[target], order[idx]];
  await Promise.all(order.map((cid, i) => admin.from("contacts").update({ sort_order: i }).eq("id", cid)));
  revalidate();
  return { ok: true };
}
