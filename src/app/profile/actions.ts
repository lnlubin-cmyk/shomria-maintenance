"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { ok: true };

/**
 * Update the signed-in user's own privacy consent. Runs with the service role
 * because RLS restricts writes to `residents` to admins — but it only ever
 * touches the caller's own resident row, re-derived from the session. External
 * (non-resident) staff have no resident row, so it's a no-op for them.
 */
export async function saveConsent(sharePhone: boolean, shareHouse: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!session.residentId) return { ok: true }; // external staff — nothing to store

  const admin = createAdminClient();
  const { error } = await admin
    .from("residents")
    .update({ share_phone: sharePhone, share_house: shareHouse })
    .eq("id", session.residentId);

  if (error) return { error: "שמירת ההעדפות נכשלה. נסה שוב." };

  revalidatePath("/profile");
  revalidatePath("/map");
  return { ok: true };
}
