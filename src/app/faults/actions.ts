"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient, getSession } from "@/lib/supabase/server";
import { sendFaultSms, resendFaultSms, FAULT_RECEIVED_MESSAGE } from "@/lib/fault-sms";
import { getBuildingFacts } from "@/lib/building-facts";
import type { BuildingFact } from "@/lib/types";
import {
  STATUS_ORDER,
  TREATMENT_TYPE_ORDER,
  PRIORITY_ORDER,
  isStaff,
  canDeleteFaults,
  type FaultStatus,
  type TreatmentType,
  type FaultPriority,
} from "@/lib/types";

export type ActionResult = { error: string } | { ok: true };

/** Spec screen 2: create a fault. Status is forced to 'received' by a DB trigger. */
export async function createFault(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };

  const callerResidentId = String(formData.get("caller_resident_id") ?? "").trim();
  const buildingPlotNumber = String(formData.get("building_plot_number") ?? "").trim();
  const faultDescription = String(formData.get("fault_description") ?? "").trim();

  if (!callerResidentId) return { error: "יש לבחור שם פונה מתוך רשימת התושבים" };
  if (!buildingPlotNumber) return { error: "יש לבחור מבנה" };
  if (!faultDescription) return { error: "יש למלא תיאור תקלה" };

  const supabase = createClient();
  const { data: created, error } = await supabase
    .from("faults")
    .insert({
      caller_resident_id: callerResidentId,
      created_by_user_id: session.user.id,
      building_plot_number: buildingPlotNumber,
      fault_description: faultDescription,
    })
    .select("fault_number")
    .single();

  if (error || !created) return { error: "שמירת הקריאה נכשלה. נסה שוב." };

  // When a staff member opens the call, they may fill in the handling fields
  // right away (including marking it תקלה תוקנה). The insert is forced to the
  // initial state by a DB trigger, so apply those fields via the normal staff
  // update path — which the column guard permits for staff, and which keeps the
  // resident protections on insert intact.
  if (isStaff(session.user.role)) {
    const patch: Record<string, unknown> = {};

    const status = String(formData.get("status") ?? "");
    if (status && STATUS_ORDER.includes(status as FaultStatus)) patch.status = status;

    const priority = String(formData.get("priority") ?? "");
    if (priority && PRIORITY_ORDER.includes(priority as FaultPriority)) patch.priority = priority;

    const treatmentType = String(formData.get("treatment_type") ?? "");
    if (treatmentType && TREATMENT_TYPE_ORDER.includes(treatmentType as TreatmentType)) {
      patch.treatment_type = treatmentType;
    }

    const treatment = String(formData.get("treatment_description") ?? "").trim();
    if (treatment) patch.treatment_description = treatment;

    const hoursRaw = String(formData.get("hours_spent") ?? "").trim();
    if (hoursRaw !== "") {
      const h = Number(hoursRaw);
      if (Number.isFinite(h) && h >= 0) patch.hours_spent = h;
    }

    const assignee = String(formData.get("assigned_to_user_id") ?? "");
    if (assignee && assignee !== "__none__") {
      const { data: worker } = await supabase
        .from("users")
        .select("id")
        .eq("id", assignee)
        .eq("is_active", true)
        .in("role", ["maintenance", "maintenance_manager"])
        .maybeSingle();
      if (worker) patch.assigned_to_user_id = assignee;
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("faults").update(patch).eq("fault_number", created.fault_number);
    }
  }

  // Automatic confirmation SMS to the resident (best-effort; always logged).
  // Suppressed when the caller is maintenance staff (איש/מנהל תחזוקה) — admins
  // still receive it.
  const admin = createAdminClient();
  const { data: callerUser } = await admin
    .from("users")
    .select("role")
    .eq("resident_id", callerResidentId)
    .maybeSingle();
  const callerIsMaintenance =
    callerUser?.role === "maintenance" || callerUser?.role === "maintenance_manager";

  if (!callerIsMaintenance) {
    try {
      await sendFaultSms(created.fault_number, FAULT_RECEIVED_MESSAGE, { automatic: true });
    } catch {
      /* SMS failure must not fail the call itself */
    }
  }

  revalidatePath("/faults");
  redirect("/faults?created=1");
}

/**
 * Spec screen 2: staff may edit only status / treatment description / treatment
 * type. Anything else in the form is ignored, and the DB guard trigger rejects
 * a non-staff caller even if this check were bypassed.
 */
export async function updateFaults(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה לערוך תקלות" };

  const ids = formData
    .getAll("fault_numbers")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) return { error: "לא נבחרו תקלות" };

  const patch: Record<string, unknown> = {};

  const status = String(formData.get("status") ?? "");
  if (status) {
    if (!STATUS_ORDER.includes(status as FaultStatus)) return { error: "סטטוס לא חוקי" };
    patch.status = status;
  }

  const treatmentType = String(formData.get("treatment_type") ?? "");
  if (treatmentType) {
    if (!TREATMENT_TYPE_ORDER.includes(treatmentType as TreatmentType)) {
      return { error: "סוג טיפול לא חוקי" };
    }
    patch.treatment_type = treatmentType;
  }

  const priority = String(formData.get("priority") ?? "");
  if (priority) {
    if (!PRIORITY_ORDER.includes(priority as FaultPriority)) {
      return { error: "עדיפות לא חוקית" };
    }
    patch.priority = priority;
  }

  // Free text. An empty string is a real value here — it clears the field —
  // so distinguish "not submitted" from "submitted empty".
  if (formData.has("treatment_description")) {
    patch.treatment_description = String(formData.get("treatment_description") ?? "").trim() || null;
  }

  // Hours the yard team spent (staff only). Empty clears it.
  if (formData.has("hours_spent")) {
    const raw = String(formData.get("hours_spent") ?? "").trim();
    if (raw === "") {
      patch.hours_spent = null;
    } else {
      const h = Number(raw);
      if (!Number.isFinite(h) || h < 0) return { error: "מספר שעות לא תקין" };
      patch.hours_spent = h;
    }
  }

  const supabase = createClient();

  // אחריות. "__none__" clears the assignment; absent means leave unchanged.
  if (formData.has("assigned_to_user_id")) {
    const assignee = String(formData.get("assigned_to_user_id") ?? "");
    if (assignee === "__none__") {
      patch.assigned_to_user_id = null;
    } else if (assignee) {
      const { data: worker } = await supabase
        .from("users")
        .select("id")
        .eq("id", assignee)
        .eq("is_active", true)
        .in("role", ["maintenance", "maintenance_manager"])
        .maybeSingle();

      if (!worker) return { error: "ניתן להקצות אחריות לאיש תחזוקה פעיל בלבד" };
      patch.assigned_to_user_id = assignee;
    }
  }

  if (Object.keys(patch).length === 0) return { error: "לא בוצעו שינויים" };

  const { error } = await supabase.from("faults").update(patch).in("fault_number", ids);

  if (error) return { error: "עדכון נכשל. נסה שוב." };

  revalidatePath("/faults");
  return { ok: true };
}

/** Spec screen 2: only מנהל תחזוקה (and admin) get the delete button. */
export async function deleteFaults(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!canDeleteFaults(session.user.role)) return { error: "אין לך הרשאה למחוק תקלות" };

  const ids = formData
    .getAll("fault_numbers")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) return { error: "לא נבחרו תקלות" };

  const supabase = createClient();
  const { error } = await supabase.from("faults").delete().in("fault_number", ids);

  if (error) return { error: "מחיקה נכשלה. נסה שוב." };

  revalidatePath("/faults");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Messages (SMS to the resident) — staff only
// ---------------------------------------------------------------------

/** Send an editable SMS to the caller and log it. Always logged; if the SMS
 *  provider fails, the message is still saved with a "not delivered" status. */
export async function sendFaultMessage(faultNumber: number, body: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה לשלוח הודעות" };

  const text = String(body ?? "").trim();
  if (!text) return { error: "יש להזין תוכן הודעה" };
  if (!Number.isInteger(faultNumber)) return { error: "קריאה חסרה" };

  await sendFaultSms(faultNumber, text, { senderUserId: session.user.id });

  revalidatePath(`/faults/${faultNumber}`);
  revalidatePath("/faults");
  return { ok: true };
}

/** Re-send a message whose SMS previously failed. */
export async function resendFaultMessage(
  messageId: string,
  faultNumber: number
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה לשלוח הודעות" };
  if (!messageId) return { error: "הודעה חסרה" };

  const r = await resendFaultSms(messageId);

  revalidatePath(`/faults/${faultNumber}`);
  revalidatePath("/faults");
  if (!r.ok) return { error: r.error ?? "השליחה נכשלה שוב. נסו שוב מאוחר יותר." };
  return { ok: true };
}

// ---------------------------------------------------------------------
// Cost items — staff only
// ---------------------------------------------------------------------

export async function addCostItem(
  faultNumber: number,
  description: string,
  amount: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };

  const desc = String(description ?? "").trim();
  if (!desc) return { error: "יש להזין תיאור" };
  const amt = Number(String(amount ?? "").trim());
  if (!Number.isFinite(amt) || amt < 0) return { error: "סכום לא תקין" };
  if (!Number.isInteger(faultNumber)) return { error: "קריאה חסרה" };

  const admin = createAdminClient();
  const { error } = await admin.from("fault_cost_items").insert({
    fault_number: faultNumber,
    description: desc,
    amount: amt,
    created_by_user_id: session.user.id,
  });
  if (error) return { error: "הוספת פריט העלות נכשלה" };

  revalidatePath(`/faults/${faultNumber}`);
  revalidatePath("/faults");
  return { ok: true };
}

export async function deleteCostItem(id: string, faultNumber: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("fault_cost_items").delete().eq("id", id);
  if (error) return { error: "מחיקת פריט העלות נכשלה" };

  revalidatePath(`/faults/${faultNumber}`);
  revalidatePath("/faults");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Building facts — useful [key, value] info staff keep per house (staff only)
// ---------------------------------------------------------------------

/** Add a [key, value] note to a house (identified by its plot number / ID). */
export async function addBuildingFact(
  plotNumber: string,
  key: string,
  value: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };

  const plot = String(plotNumber ?? "").trim();
  const k = String(key ?? "").trim();
  const v = String(value ?? "").trim();
  if (!plot) return { error: "יש לבחור בית" };
  if (!k) return { error: "יש להזין שם שדה (מפתח)" };

  const admin = createAdminClient();
  // Guard against a bad house ID so the info isn't stored against nothing.
  const { data: building } = await admin
    .from("buildings")
    .select("plot_number")
    .eq("plot_number", plot)
    .maybeSingle();
  if (!building) return { error: "מספר הבית אינו קיים" };

  const { error } = await admin.from("building_facts").insert({
    plot_number: plot,
    key: k,
    value: v,
    created_by_user_id: session.user.id,
  });
  if (error) return { error: "שמירת המידע נכשלה" };

  revalidatePath("/faults");
  return { ok: true };
}

export async function deleteBuildingFact(id: string, plotNumber: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };
  if (!id) return { error: "פריט חסר" };

  const admin = createAdminClient();
  const { error } = await admin.from("building_facts").delete().eq("id", id);
  if (error) return { error: "מחיקת המידע נכשלה" };

  revalidatePath("/faults");
  return { ok: true };
}

/** Fetch a house's facts (for the add-info dialog). Staff only. */
export async function fetchBuildingFacts(
  plotNumber: string
): Promise<{ facts: BuildingFact[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!isStaff(session.user.role)) return { error: "אין לך הרשאה" };
  return { facts: await getBuildingFacts(plotNumber) };
}

// ---------------------------------------------------------------------
// Resident feedback — a 1-5 rating of how the call was handled
// ---------------------------------------------------------------------

/**
 * The caller rates the handling of their call (1-5), once the fix is done. The
 * rating is only ever readable by מנהל תחזוקה/admin (enforced by RLS); the write
 * runs with the service role after verifying the caller and the call status.
 */
export async function submitFeedback(
  faultNumber: number,
  rating: number
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };

  const r = Math.trunc(Number(rating));
  if (!Number.isInteger(r) || r < 1 || r > 5) return { error: "יש לבחור דירוג בין 1 ל-5" };
  if (!Number.isInteger(faultNumber)) return { error: "קריאה חסרה" };

  const admin = createAdminClient();
  const { data: fault } = await admin
    .from("faults")
    .select("caller_resident_id, created_by_user_id, status")
    .eq("fault_number", faultNumber)
    .maybeSingle();
  if (!fault) return { error: "הקריאה לא נמצאה" };

  const isCaller =
    fault.caller_resident_id === session.residentId ||
    fault.created_by_user_id === session.user.id;
  if (!isCaller) return { error: "ניתן לדרג רק קריאה שנפתחה עבורך" };
  if (fault.status !== "fixed" && fault.status !== "closed") {
    return { error: "ניתן לדרג את הטיפול לאחר סיום הטיפול בקריאה" };
  }

  const { error } = await admin
    .from("fault_feedback")
    .upsert(
      { fault_number: faultNumber, rating: r, created_by_user_id: session.user.id, updated_at: new Date().toISOString() },
      { onConflict: "fault_number" }
    );
  if (error) return { error: "שמירת הדירוג נכשלה" };

  revalidatePath("/faults");
  revalidatePath(`/faults/${faultNumber}`);
  return { ok: true };
}
