"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getSession } from "@/lib/supabase/server";
import { isCommitteeMember } from "@/lib/votes";
import { voteState } from "@/lib/types";

export type ActionResult = { error: string } | { ok: true };

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.map((v) => String(v)).filter((s) => s.length > 0);
}

/**
 * Cast the signed-in resident's own vote. The ballot itself is never stored —
 * cast_vote (SECURITY DEFINER) records participation and moves anonymous
 * counters atomically, and returns a Hebrew error if the vote is closed, the
 * resident already voted, or the selection is invalid.
 */
export async function castVote(voteId: string, optionIds: string[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };
  if (!session.residentId) return { error: "רק תושב רשום רשאי להצביע" };

  const ids = cleanIds(optionIds);
  if (ids.length === 0) return { error: "יש לבחור לפחות אפשרות אחת" };

  const supabase = createClient();
  const { error } = await supabase.rpc("cast_vote", {
    p_vote_id: voteId,
    p_option_ids: ids,
    p_on_behalf_resident_id: null,
  });
  if (error) return { error: error.message || "ההצבעה נכשלה. נסו שוב." };

  revalidatePath(`/votes/${voteId}`);
  revalidatePath("/votes");
  return { ok: true };
}

/**
 * A ועדת קלפי member enters a vote on behalf of a resident who can't access the
 * app. The resident is then marked as having voted and cannot vote again.
 */
export async function castVoteOnBehalf(
  voteId: string,
  residentId: string,
  optionIds: string[]
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };

  const allowed = session.user.role === "admin" || (await isCommitteeMember(voteId, session.residentId));
  if (!allowed) return { error: "רק חבר ועדת קלפי רשאי להזין הצבעה עבור תושב אחר" };

  const rid = String(residentId ?? "").trim();
  if (!rid) return { error: "יש לבחור תושב" };
  const ids = cleanIds(optionIds);
  if (ids.length === 0) return { error: "יש לבחור לפחות אפשרות אחת" };

  const supabase = createClient();
  const { error } = await supabase.rpc("cast_vote", {
    p_vote_id: voteId,
    p_option_ids: ids,
    p_on_behalf_resident_id: rid,
  });
  if (error) return { error: error.message || "ההצבעה נכשלה. נסו שוב." };

  revalidatePath(`/votes/${voteId}`);
  revalidatePath("/votes");
  return { ok: true };
}

/** Close a vote early. Any committee member (or admin) may do this. */
export async function closeVote(voteId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "לא מחובר" };

  const allowed = session.user.role === "admin" || (await isCommitteeMember(voteId, session.residentId));
  if (!allowed) return { error: "רק חבר ועדת קלפי רשאי לסגור את ההצבעה" };

  const admin = createAdminClient();
  const { data: vote } = await admin
    .from("votes")
    .select("start_at, closes_at, closed_at, closure_mode")
    .eq("id", voteId)
    .maybeSingle();
  if (!vote) return { error: "ההצבעה לא נמצאה" };
  if (voteState(vote as never) === "closed") return { error: "ההצבעה כבר סגורה" };

  const { error } = await admin
    .from("votes")
    .update({ closed_at: new Date().toISOString(), closed_by_user_id: session.user.id })
    .eq("id", voteId);
  if (error) return { error: "סגירת ההצבעה נכשלה" };

  revalidatePath(`/votes/${voteId}`);
  revalidatePath("/votes");
  revalidatePath("/", "layout"); // drop it from the "active vote" nav
  return { ok: true };
}
