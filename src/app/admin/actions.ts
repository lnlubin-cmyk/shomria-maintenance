"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { normalizeEmail } from "@/lib/email";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

export type ActionResult = { error: string } | { ok: true; message?: string };

/**
 * Every action here re-checks the caller is an admin. The service-role client
 * bypasses RLS, so this function is the only thing standing between a
 * non-admin and the whole database — it must run first, every time.
 */
async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

const VALID_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

// ---------------------------------------------------------------------------
// תושבים
// ---------------------------------------------------------------------------

export async function upsertResident(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();

  if (!id) return { error: "תעודת זהות חובה" };
  if (!firstName) return { error: "שם פרטי חובה" };
  if (!lastName) return { error: "שם משפחה חובה" };

  const phone = normalizeIsraeliPhone(phoneRaw);
  if (!phone) return { error: "מספר טלפון אינו תקין" };

  // Email is optional on the record, but if given it must be valid — it's the
  // login identifier, and a malformed one means the resident can never sign in.
  let email: string | null = null;
  if (emailRaw) {
    email = normalizeEmail(emailRaw);
    if (!email) return { error: "כתובת האימייל אינה תקינה" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("residents")
    .upsert({ id, first_name: firstName, last_name: lastName, phone, email }, { onConflict: "id" });

  if (error) {
    if (error.code === "23505") {
      return { error: "מספר הטלפון או האימייל כבר רשומים לתושב אחר" };
    }
    return { error: "שמירת התושב נכשלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteResident(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "תעודת זהות חסרה" };

  const admin = createAdminClient();
  const { error } = await admin.from("residents").delete().eq("id", id);

  if (error) {
    // FK restrict: the resident is referenced by a user account or a fault.
    if (error.code === "23503") {
      return { error: "לא ניתן למחוק תושב שיש לו חשבון משתמש או קריאות במערכת" };
    }
    return { error: "מחיקת התושב נכשלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// מבנים
// ---------------------------------------------------------------------------

export async function upsertBuilding(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const plotNumber = String(formData.get("plot_number") ?? "").trim();
  const buildingName = String(formData.get("building_name") ?? "").trim();

  if (!plotNumber) return { error: "מספר מגרש חובה" };
  if (!buildingName) return { error: "שם המבנה חובה" };

  const optional = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };

  const admin = createAdminClient();
  const { error } = await admin.from("buildings").upsert(
    {
      plot_number: plotNumber,
      building_name: buildingName,
      street_name: optional("street_name"),
      house_number: optional("house_number"),
      resident_1: optional("resident_1"),
      resident_2: optional("resident_2"),
      resident_3: optional("resident_3"),
      resident_4: optional("resident_4"),
    },
    { onConflict: "plot_number" }
  );

  if (error) {
    if (error.code === "23503") return { error: "אחת מתעודות הזהות אינה קיימת בטבלת התושבים" };
    return { error: "שמירת המבנה נכשלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteBuilding(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const plotNumber = String(formData.get("plot_number") ?? "").trim();
  if (!plotNumber) return { error: "מספר מגרש חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("buildings").delete().eq("plot_number", plotNumber);

  if (error) {
    if (error.code === "23503") return { error: "לא ניתן למחוק מבנה שיש לו קריאות במערכת" };
    return { error: "מחיקת המבנה נכשלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// משתמשים
// ---------------------------------------------------------------------------

/**
 * Creates an auth account for an existing resident and links it. The resident
 * can then sign in with the phone OTP flow — no password is ever set here.
 */
export async function createUser(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const residentId = String(formData.get("resident_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!residentId) return { error: "יש לבחור תושב" };
  if (!VALID_ROLES.includes(role as UserRole)) return { error: "סוג משתמש לא חוקי" };

  const admin = createAdminClient();

  const { data: resident } = await admin
    .from("residents")
    .select("id, phone, email")
    .eq("id", residentId)
    .maybeSingle();

  if (!resident) return { error: "התושב אינו קיים" };

  // Login is by email, so an account can't exist without one. The admin sets
  // the resident's email on the תושבים tab first.
  if (!resident.email) {
    return { error: "לתושב זה אין אימייל. יש להוסיף אימייל בכרטיס התושב לפני יצירת חשבון." };
  }

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("resident_id", residentId)
    .maybeSingle();

  if (existing) return { error: "לתושב זה כבר קיים חשבון" };

  // email_confirm: the admin is vouching for the address, so skip the
  // confirmation email — the resident just signs in with a code.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: resident.email,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return { error: "יצירת חשבון ההתחברות נכשלה" };
  }

  const { error } = await admin.from("users").insert({
    id: created.user.id,
    resident_id: residentId,
    role,
    email: resident.email,
    phone: resident.phone,
  });

  if (error) {
    // Roll back the orphaned auth account so a retry isn't blocked by it.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "יצירת המשתמש נכשלה" };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUserRole(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const userId = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!userId) return { error: "משתמש חסר" };
  if (!VALID_ROLES.includes(role as UserRole)) return { error: "סוג משתמש לא חוקי" };

  // Guard against the last admin demoting themselves and locking everyone out.
  if (userId === session.user.id && role !== "admin") {
    const admin = createAdminClient();
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return { error: "לא ניתן להסיר את הרשאת האדמין האחרונה במערכת" };
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ role }).eq("id", userId);

  if (error) return { error: "עדכון סוג המשתמש נכשל" };

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) return { error: "משתמש חסר" };
  if (userId === session.user.id) return { error: "לא ניתן למחוק את המשתמש שלך" };

  const admin = createAdminClient();

  // Deleting the auth account cascades to public.users.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { error: "לא ניתן למחוק משתמש שפתח קריאות. ניתן להשבית אותו במקום." };
  }

  revalidatePath("/admin");
  return { ok: true };
}
