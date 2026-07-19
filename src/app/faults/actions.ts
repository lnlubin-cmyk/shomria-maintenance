"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSession } from "@/lib/supabase/server";
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
  const { error } = await supabase.from("faults").insert({
    caller_resident_id: callerResidentId,
    created_by_user_id: session.user.id,
    building_plot_number: buildingPlotNumber,
    fault_description: faultDescription,
  });

  if (error) return { error: "שמירת הקריאה נכשלה. נסה שוב." };

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
