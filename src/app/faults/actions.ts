"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient, getSession } from "@/lib/supabase/server";
import { sendFaultSms, FAULT_RECEIVED_MESSAGE } from "@/lib/fault-sms";
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

  // Automatic confirmation SMS to the resident (best-effort; always logged).
  try {
    await sendFaultSms(created.fault_number, FAULT_RECEIVED_MESSAGE, { automatic: true });
  } catch {
    /* SMS failure must not fail the call itself */
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
