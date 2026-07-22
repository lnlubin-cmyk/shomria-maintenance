"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { normalizeIsraeliPhone, phoneAccountEmail } from "@/lib/phone";
import { normalizeEmail } from "@/lib/email";
import { itmToWgs84 } from "@/lib/geo";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

export type ActionResult = { error: string } | { ok: true; message?: string };

/**
 * Store a building's location on the map. The admin clicked it on the govmap
 * map (ITM), so we save the ITM and its WGS84 equivalent (navigation links and
 * mobile maps need WGS84). Admin only.
 */
export async function saveBuildingLocation(
  plotNumber: string,
  itmX: number,
  itmY: number
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!plotNumber) return { error: "מבנה חסר" };
  if (!Number.isFinite(itmX) || !Number.isFinite(itmY)) return { error: "קואורדינטה לא תקינה" };

  const { lat, lng } = itmToWgs84(itmX, itmY);

  const admin = createAdminClient();
  const { error } = await admin
    .from("buildings")
    .update({ itm_x: itmX, itm_y: itmY, latitude: lat, longitude: lng })
    .eq("plot_number", plotNumber);

  if (error) return { error: "שמירת המיקום נכשלה" };

  revalidatePath("/admin");
  revalidatePath("/map");
  return { ok: true };
}

/** Remove a building's location (unplace it). Admin only. */
export async function clearBuildingLocation(plotNumber: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!plotNumber) return { error: "מבנה חסר" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("buildings")
    .update({ itm_x: null, itm_y: null, latitude: null, longitude: null })
    .eq("plot_number", plotNumber);

  if (error) return { error: "הסרת המיקום נכשלה" };

  revalidatePath("/admin");
  revalidatePath("/map");
  return { ok: true };
}

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
  const layerRaw = String(formData.get("layer_id") ?? "").trim();

  if (!plotNumber) return { error: "מספר מגרש חובה" };
  if (!buildingName) return { error: "שם המבנה חובה" };
  if (!layerRaw) return { error: "יש לבחור שכבה" };
  const layerId = Number(layerRaw);
  if (!Number.isInteger(layerId)) return { error: "שכבה לא חוקית" };

  const optional = (key: string) => {
    const v = String(formData.get(key) ?? "").trim();
    return v === "" ? null : v;
  };

  const admin = createAdminClient();
  const { error } = await admin.from("buildings").upsert(
    {
      plot_number: plotNumber,
      building_name: buildingName,
      layer_id: layerId,
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
    if (error.code === "23503") {
      return { error: "אחת מתעודות הזהות אינה קיימת, או שהשכבה אינה קיימת" };
    }
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

// Roles allowed for a non-resident (external) account.
const EXTERNAL_ROLES: UserRole[] = ["maintenance", "maintenance_manager"];

/**
 * Creates an account. Two kinds:
 *  - "resident": linked to an existing resident. The auth account is always
 *    keyed on a synthetic phone-based email so login-by-phone works for every
 *    resident (matches the SMS registration flow); the real email, if any, is
 *    kept only as contact info.
 *  - "external": a non-resident maintenance worker/manager with their own name
 *    and email (e.g. an outside contractor).
 * No password is set here — the owner signs in with the code flow.
 */
export async function createUser(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const kind = String(formData.get("kind") ?? "resident").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!VALID_ROLES.includes(role as UserRole)) return { error: "סוג משתמש לא חוקי" };

  const admin = createAdminClient();

  // Fields for the users row and the auth account, filled per kind below.
  // accountEmail is the auth login identifier (may be synthetic for phone-only
  // residents); contactEmail is the real email stored on the users row, or null.
  let residentId: string | null = null;
  let accountEmail: string;
  let contactEmail: string | null = null;
  let phone: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (kind === "external") {
    if (!EXTERNAL_ROLES.includes(role as UserRole)) {
      return { error: "משתמש שאינו תושב יכול להיות איש תחזוקה או מנהל תחזוקה בלבד" };
    }

    firstName = String(formData.get("first_name") ?? "").trim();
    lastName = String(formData.get("last_name") ?? "").trim();
    const emailNorm = normalizeEmail(String(formData.get("email") ?? ""));
    phone = normalizeIsraeliPhone(String(formData.get("phone") ?? "")) || null;

    if (!firstName) return { error: "שם פרטי חובה" };
    if (!lastName) return { error: "שם משפחה חובה" };
    if (!emailNorm) return { error: "כתובת אימייל אינה תקינה" };
    accountEmail = emailNorm;
    contactEmail = emailNorm;

    // Email must be free across both residents and existing accounts.
    const { data: takenResident } = await admin
      .from("residents")
      .select("id")
      .eq("email", accountEmail)
      .maybeSingle();
    if (takenResident) {
      return { error: "האימייל שייך לתושב קיים. צור עבורו משתמש דרך „תושב קיים”." };
    }
    const { data: takenUser } = await admin
      .from("users")
      .select("id")
      .eq("email", accountEmail)
      .maybeSingle();
    if (takenUser) return { error: "כתובת האימייל כבר רשומה למשתמש אחר" };
  } else {
    residentId = String(formData.get("resident_id") ?? "").trim();
    if (!residentId) return { error: "יש לבחור תושב" };

    const { data: resident } = await admin
      .from("residents")
      .select("id, phone, email")
      .eq("id", residentId)
      .maybeSingle();

    if (!resident) return { error: "התושב אינו קיים" };

    const { data: existing } = await admin
      .from("users")
      .select("id")
      .eq("resident_id", residentId)
      .maybeSingle();
    if (existing) return { error: "לתושב זה כבר קיים חשבון" };

    phone = resident.phone;
    contactEmail = resident.email ?? null;
    // Auth login is always by phone → synthetic email, so login-by-phone works
    // for every resident regardless of whether they have a real email on file.
    accountEmail = phoneAccountEmail(resident.phone);
  }

  // email_confirm: the admin vouches for the address, so skip the confirmation
  // email — the person just signs in with a code.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: accountEmail,
    email_confirm: true,
  });

  if (authError || !created.user) {
    return { error: "יצירת חשבון ההתחברות נכשלה" };
  }

  const { error } = await admin.from("users").insert({
    id: created.user.id,
    resident_id: residentId,
    role,
    first_name: firstName,
    last_name: lastName,
    email: contactEmail,
    phone,
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

  const admin = createAdminClient();

  // An external (non-resident) user can only hold a maintenance role — the DB
  // check constraint enforces this, but catch it here for a clear message.
  const { data: target } = await admin
    .from("users")
    .select("resident_id")
    .eq("id", userId)
    .maybeSingle();
  if (target && !target.resident_id && !EXTERNAL_ROLES.includes(role as UserRole)) {
    return { error: "משתמש שאינו תושב יכול להיות איש תחזוקה או מנהל תחזוקה בלבד" };
  }

  // Guard against the last admin demoting themselves and locking everyone out.
  if (userId === session.user.id && role !== "admin") {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) <= 1) {
      return { error: "לא ניתן להסיר את הרשאת האדמין האחרונה במערכת" };
    }
  }

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
