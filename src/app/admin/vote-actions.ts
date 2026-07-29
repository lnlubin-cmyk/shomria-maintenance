"use server";

import { revalidatePath } from "next/cache";
import { getSession, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { ok: true };

export interface CreateVoteInput {
  title: string;
  description: string;
  subject: string;
  format: "options" | "election";
  maxSelections: number;
  startAt: string; // ISO
  closureMode: "manual" | "scheduled";
  closesAt: string | null; // ISO, required when scheduled
  optionLabels: string[]; // format === "options"
  candidateIds: string[]; // format === "election"
  memberIds: string[]; // ועדת קלפי
}

export interface UpdateVoteMetaInput {
  id: string;
  title: string;
  description: string;
  subject: string;
  startAt: string;
  closureMode: "manual" | "scheduled";
  closesAt: string | null;
  maxSelections: number;
}

const MAX_OPTIONS = 20;
const MAX_CANDIDATES = 50;
const MAX_COMMITTEE = 15;

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("לא מחובר");
  if (session.user.role !== "admin") throw new Error("אין לך הרשאת אדמין");
  return session;
}

function revalidate() {
  revalidatePath("/admin");
  revalidatePath("/votes");
  revalidatePath("/", "layout"); // refresh the "active vote" nav
}

/** Parse an ISO timestamp; returns null if it isn't a valid date. */
function parseIso(s: string): string | null {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export async function createVote(input: CreateVoteInput): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  const title = input.title?.trim() ?? "";
  const subject = input.subject?.trim() ?? "";
  const description = input.description?.trim() || null;
  if (!title) return { error: "יש להזין כותרת להצבעה" };
  if (!subject) return { error: "יש להזין את נושא/שאלת ההצבעה" };

  if (input.format !== "options" && input.format !== "election") {
    return { error: "סוג הצבעה לא חוקי" };
  }
  if (input.closureMode !== "manual" && input.closureMode !== "scheduled") {
    return { error: "אופן סגירה לא חוקי" };
  }

  const startAt = parseIso(input.startAt);
  if (!startAt) return { error: "יש להגדיר תאריך ושעת פתיחה" };

  let closesAt: string | null = null;
  if (input.closureMode === "scheduled") {
    closesAt = input.closesAt ? parseIso(input.closesAt) : null;
    if (!closesAt) return { error: "בסגירה מתוזמנת יש להגדיר תאריך ושעת סגירה" };
    if (Date.parse(closesAt) <= Date.parse(startAt)) {
      return { error: "זמן הסגירה חייב להיות אחרי זמן הפתיחה" };
    }
  }

  // Build the options list.
  const admin = createAdminClient();
  let optionRows: { label: string; candidate_resident_id: string | null }[] = [];

  if (input.format === "options") {
    const labels = (input.optionLabels ?? []).map((s) => s.trim()).filter(Boolean);
    if (labels.length < 2) return { error: "יש להזין לפחות שתי אפשרויות" };
    if (labels.length > MAX_OPTIONS) return { error: `עד ${MAX_OPTIONS} אפשרויות` };
    optionRows = labels.map((l) => ({ label: l, candidate_resident_id: null }));
  } else {
    const ids = [...new Set((input.candidateIds ?? []).map((s) => s.trim()).filter(Boolean))];
    if (ids.length < 2) return { error: "יש לבחור לפחות שני מועמדים" };
    if (ids.length > MAX_CANDIDATES) return { error: `עד ${MAX_CANDIDATES} מועמדים` };
    const { data: residents } = await admin
      .from("residents")
      .select("id, first_name, last_name")
      .in("id", ids);
    const nameById = new Map((residents ?? []).map((r) => [r.id, `${r.first_name} ${r.last_name}`]));
    if (nameById.size !== ids.length) return { error: "מועמד לא נמצא ברשימת התושבים" };
    optionRows = ids.map((id) => ({ label: nameById.get(id)!, candidate_resident_id: id }));
  }

  const maxSel = Math.trunc(Number(input.maxSelections));
  if (!Number.isInteger(maxSel) || maxSel < 1) {
    return { error: "מספר הבחירות המרבי חייב להיות 1 לפחות" };
  }
  if (maxSel > optionRows.length) {
    return { error: "מספר הבחירות המרבי לא יכול לעלות על מספר האפשרויות" };
  }

  const memberIds = [...new Set((input.memberIds ?? []).map((s) => s.trim()).filter(Boolean))];
  if (memberIds.length < 1) return { error: "יש לבחור לפחות חבר ועדת קלפי אחד" };
  if (memberIds.length > MAX_COMMITTEE) return { error: `עד ${MAX_COMMITTEE} חברי ועדת קלפי` };

  // Insert the vote, then its options and committee. On any failure, remove the
  // vote (cascades to the children) so we never leave a half-built vote.
  const { data: vote, error } = await admin
    .from("votes")
    .insert({
      title,
      description,
      subject,
      format: input.format,
      max_selections: maxSel,
      start_at: startAt,
      closure_mode: input.closureMode,
      closes_at: closesAt,
      created_by_user_id: session.user.id,
    })
    .select("id")
    .single();
  if (error || !vote) return { error: "יצירת ההצבעה נכשלה" };

  const { error: optErr } = await admin
    .from("vote_options")
    .insert(optionRows.map((o, i) => ({ vote_id: vote.id, ...o, sort_order: i })));
  if (optErr) {
    await admin.from("votes").delete().eq("id", vote.id);
    return { error: "שמירת האפשרויות נכשלה" };
  }

  const { error: memErr } = await admin
    .from("vote_committee")
    .insert(memberIds.map((rid) => ({ vote_id: vote.id, resident_id: rid })));
  if (memErr) {
    await admin.from("votes").delete().eq("id", vote.id);
    return { error: "שמירת ועדת הקלפי נכשלה" };
  }

  revalidate();
  return { ok: true };
}

/**
 * Edit a vote's metadata. Options and committee are fixed at creation (changing
 * them after votes are cast would corrupt the tallies), so they are not editable
 * here.
 */
export async function updateVoteMeta(input: UpdateVoteMetaInput): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }

  if (!input.id) return { error: "הצבעה חסרה" };
  const title = input.title?.trim() ?? "";
  const subject = input.subject?.trim() ?? "";
  if (!title) return { error: "יש להזין כותרת להצבעה" };
  if (!subject) return { error: "יש להזין את נושא/שאלת ההצבעה" };
  if (input.closureMode !== "manual" && input.closureMode !== "scheduled") {
    return { error: "אופן סגירה לא חוקי" };
  }

  const startAt = parseIso(input.startAt);
  if (!startAt) return { error: "יש להגדיר תאריך ושעת פתיחה" };

  let closesAt: string | null = null;
  if (input.closureMode === "scheduled") {
    closesAt = input.closesAt ? parseIso(input.closesAt) : null;
    if (!closesAt) return { error: "בסגירה מתוזמנת יש להגדיר תאריך ושעת סגירה" };
    if (Date.parse(closesAt) <= Date.parse(startAt)) {
      return { error: "זמן הסגירה חייב להיות אחרי זמן הפתיחה" };
    }
  }

  const maxSel = Math.trunc(Number(input.maxSelections));
  if (!Number.isInteger(maxSel) || maxSel < 1) {
    return { error: "מספר הבחירות המרבי חייב להיות 1 לפחות" };
  }

  const admin = createAdminClient();
  // Guard the max-selection bound against the actual number of options.
  const { count: optionCount } = await admin
    .from("vote_options")
    .select("*", { count: "exact", head: true })
    .eq("vote_id", input.id);
  if (optionCount && maxSel > optionCount) {
    return { error: "מספר הבחירות המרבי לא יכול לעלות על מספר האפשרויות" };
  }

  const { error } = await admin
    .from("votes")
    .update({
      title,
      description: input.description?.trim() || null,
      subject,
      start_at: startAt,
      closure_mode: input.closureMode,
      closes_at: closesAt,
      max_selections: maxSel,
    })
    .eq("id", input.id);
  if (error) return { error: "עדכון ההצבעה נכשל" };

  revalidate();
  return { ok: true };
}

export async function deleteVote(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!id) return { error: "הצבעה חסרה" };

  const admin = createAdminClient();
  const { error } = await admin.from("votes").delete().eq("id", id);
  if (error) return { error: "מחיקת ההצבעה נכשלה" };

  revalidate();
  return { ok: true };
}
