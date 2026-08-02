import { createAdminClient } from "@/lib/supabase/server";
import {
  isVoteOpen,
  voteState,
  type Vote,
  type VoteOption,
  type VoteCommitteeMember,
  type VoteOutcome,
  type VoteProtocol,
  type VoteProtocolResult,
  type VoteRosterEntry,
} from "@/lib/types";

/** A vote with its options and committee, for the admin management tab. */
export interface AdminVote extends Vote {
  options: VoteOption[];
  committee: VoteCommitteeMember[];
}

/** The open vote(s) shown in the nav. Usually zero or one. */
export async function getActiveVotesForMenu(): Promise<{ id: string; title: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("votes")
    .select("id, title, start_at, closes_at, closed_at, closure_mode")
    .is("closed_at", null)
    .order("start_at", { ascending: false });

  return (data ?? [])
    .filter((v) => isVoteOpen(v as Vote))
    .map((v) => ({ id: v.id, title: v.title }));
}

/** Every vote, newest first — the /votes list and the admin tab. */
export async function getAllVotes(): Promise<Vote[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("votes").select("*").order("start_at", { ascending: false });
  return (data ?? []) as Vote[];
}

export async function getVoteById(id: string): Promise<Vote | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("votes").select("*").eq("id", id).maybeSingle();
  return (data as Vote) ?? null;
}

export async function getVoteOptions(voteId: string): Promise<VoteOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_options")
    .select("id, label, candidate_resident_id, sort_order")
    .eq("vote_id", voteId)
    .order("sort_order");
  return (data ?? []) as VoteOption[];
}

export async function getVoteCommittee(voteId: string): Promise<VoteCommitteeMember[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_committee")
    .select("resident_id, resident:residents(first_name, last_name)")
    .eq("vote_id", voteId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    resident_id: c.resident_id,
    first_name: c.resident?.first_name ?? "",
    last_name: c.resident?.last_name ?? "",
  }));
}

export async function isCommitteeMember(
  voteId: string,
  residentId: string | null
): Promise<boolean> {
  if (!residentId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_committee")
    .select("id")
    .eq("vote_id", voteId)
    .eq("resident_id", residentId)
    .maybeSingle();
  return !!data;
}

export async function hasResidentVoted(
  voteId: string,
  residentId: string | null
): Promise<boolean> {
  if (!residentId) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("vote_participants")
    .select("id")
    .eq("vote_id", voteId)
    .eq("resident_id", residentId)
    .maybeSingle();
  return !!data;
}

/**
 * A vote's outcome — per-option electronic + approved paper counts, turnout, and
 * the paper-count approval state. Returns null while the vote is open or upcoming
 * (results are never revealed before closure). `ready` is false while a vote with
 * paper ballots still awaits its unanimously approved manual count.
 */
export async function getVoteOutcome(vote: Vote): Promise<VoteOutcome | null> {
  if (voteState(vote) !== "closed") return null;

  const admin = createAdminClient();
  const { data: options } = await admin
    .from("vote_options")
    .select("id, label, sort_order")
    .eq("vote_id", vote.id)
    .order("sort_order");
  const opts = options ?? [];
  const ids = opts.map((o) => o.id);

  const [{ data: tallies }, { data: paperRows }, { data: submission }, { data: approvals }] =
    await Promise.all([
      ids.length
        ? admin.from("vote_tallies").select("option_id, count, decline_count").in("option_id", ids)
        : Promise.resolve({
            data: [] as { option_id: string; count: number; decline_count: number }[],
          }),
      admin.from("vote_paper_counts").select("option_id, count, decline_count").eq("vote_id", vote.id),
      admin
        .from("vote_paper_submission")
        .select("entered_by_user_id, entered_at, manual_voters")
        .eq("vote_id", vote.id)
        .maybeSingle(),
      admin.from("vote_paper_approvals").select("resident_id").eq("vote_id", vote.id),
    ]);

  const electById = new Map((tallies ?? []).map((t) => [t.option_id, t.count]));
  const paperById = new Map((paperRows ?? []).map((t) => [t.option_id, t.count]));
  const declElectById = new Map((tallies ?? []).map((t) => [t.option_id, t.decline_count ?? 0]));
  const declPaperById = new Map((paperRows ?? []).map((t) => [t.option_id, t.decline_count ?? 0]));

  const [{ count: committeeSize }, { count: paperVoters }, { count: totalVoters }] =
    await Promise.all([
      admin.from("vote_committee").select("*", { count: "exact", head: true }).eq("vote_id", vote.id),
      admin
        .from("vote_participants")
        .select("*", { count: "exact", head: true })
        .eq("vote_id", vote.id)
        .eq("method", "paper"),
      admin.from("vote_participants").select("*", { count: "exact", head: true }).eq("vote_id", vote.id),
    ]);

  const approvedResidentIds = (approvals ?? []).map((a) => a.resident_id);
  const size = committeeSize ?? 0;
  const finalized = !!submission && size > 0 && approvedResidentIds.length >= size;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submittedManualVoters = ((submission as any)?.manual_voters as number) ?? 0;
  const markedPaper = paperVoters ?? 0;
  // Manual turnout = marked paper voters, or the number entered with the count.
  const manualVoters = Math.max(markedPaper, submittedManualVoters);
  // Any manual data (marked voters or an entered count) means the results wait
  // for the approved manual count before they're final.
  const required = markedPaper > 0 || !!submission;
  // Effective turnout: electronic participants + manual voters (some of whom may
  // not be individual participants when only the count was entered).
  const electronicVoters = (totalVoters ?? 0) - markedPaper;
  const effectiveTotal = electronicVoters + manualVoters;

  let enteredByName: string | null = null;
  if (submission?.entered_by_user_id) {
    const { data: u } = await admin
      .from("users")
      .select("first_name, last_name, resident:residents(first_name, last_name)")
      .eq("id", submission.entered_by_user_id)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uu = u as any;
    enteredByName = uu?.resident
      ? `${uu.resident.first_name} ${uu.resident.last_name}`
      : uu?.first_name && uu?.last_name
        ? `${uu.first_name} ${uu.last_name}`
        : null;
  }

  let lines = opts.map((o) => {
    const electronic = electById.get(o.id) ?? 0;
    const paper = paperById.get(o.id) ?? 0;
    const declineElectronic = declElectById.get(o.id) ?? 0;
    const declinePaper = declPaperById.get(o.id) ?? 0;
    return {
      id: o.id,
      label: o.label,
      electronic,
      paper,
      total: electronic + (finalized ? paper : 0),
      declineElectronic,
      declinePaper,
      declineTotal: declineElectronic + (finalized ? declinePaper : 0),
    };
  });
  if (vote.format === "election") lines = lines.sort((a, b) => b.total - a.total);

  const counts: Record<string, number> = {};
  for (const [k, v] of paperById) counts[k] = v;
  const declineCounts: Record<string, number> = {};
  for (const [k, v] of declPaperById) declineCounts[k] = v;

  return {
    ready: !required || finalized,
    totalVoters: effectiveTotal,
    options: lines,
    paper: {
      paperVoters: markedPaper,
      submittedManualVoters,
      required,
      submissionExists: !!submission,
      enteredByName,
      enteredAt: submission?.entered_at ?? null,
      counts,
      declineCounts,
      approvedResidentIds,
      committeeSize: size,
      finalized,
    },
  };
}

/**
 * The written protocol (regulatory record) of a finally-closed vote. Returns the
 * stored snapshot if one exists; otherwise, if the vote is final (closed and its
 * manual count approved, if any), it computes and stores the snapshot, then
 * returns it. Returns null while the vote isn't final yet.
 */
export async function getVoteProtocol(vote: Vote): Promise<VoteProtocol | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("vote_protocols")
    .select("content, generated_at")
    .eq("vote_id", vote.id)
    .maybeSingle();
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...(existing.content as any), generatedAt: existing.generated_at } as VoteProtocol;
  }

  const outcome = await getVoteOutcome(vote);
  if (!outcome || !outcome.ready) return null;

  const committee = await getVoteCommittee(vote.id);
  // Manual turnout: the marked paper voters or the number entered with the count.
  const manualCount = Math.max(outcome.paper.paperVoters, outcome.paper.submittedManualVoters);
  const total = outcome.totalVoters; // already electronic + manual
  const electronicCount = total - manualCount;

  const results: VoteProtocolResult[] = outcome.options.map((o) =>
    vote.format === "membership"
      ? { label: o.label, accept: o.total, decline: o.declineTotal }
      : { label: o.label, votes: o.total }
  );

  const content = {
    title: vote.title,
    subject: vote.subject,
    description: vote.description,
    format: vote.format,
    startAt: vote.start_at,
    closesAt: vote.closes_at,
    closedAt: vote.closed_at,
    closureMode: vote.closure_mode,
    committee: committee.map((c) => `${c.first_name} ${c.last_name}`),
    turnout: { total, electronic: electronicCount, manual: manualCount },
    results,
  };

  await admin.from("vote_protocols").upsert({ vote_id: vote.id, content }, { onConflict: "vote_id" });
  const { data: saved } = await admin
    .from("vote_protocols")
    .select("generated_at")
    .eq("vote_id", vote.id)
    .maybeSingle();

  return { ...content, generatedAt: saved?.generated_at ?? "" } as VoteProtocol;
}

/**
 * The committee's turnout view: residents who have voted and those who have not.
 * The eligible universe is every resident, since the committee may enter a vote
 * on behalf of anyone. Choices are never included — only who has participated.
 */
export async function getVoteRoster(
  voteId: string
): Promise<{ voted: VoteRosterEntry[]; notVoted: VoteRosterEntry[] }> {
  const admin = createAdminClient();
  const [{ data: parts }, { data: residents }] = await Promise.all([
    admin.from("vote_participants").select("resident_id, method").eq("vote_id", voteId),
    // Only kibbutz members are eligible, so the turnout universe is members.
    admin.from("residents").select("id, first_name, last_name").eq("is_member", true).order("last_name"),
  ]);

  const methodByResident = new Map(
    (parts ?? []).map((p) => [p.resident_id, (p.method ?? "self") as VoteRosterEntry["method"]])
  );
  const voted: VoteRosterEntry[] = [];
  const notVoted: VoteRosterEntry[] = [];

  for (const r of residents ?? []) {
    if (methodByResident.has(r.id)) {
      voted.push({
        resident_id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        method: methodByResident.get(r.id),
      });
    } else {
      notVoted.push({ resident_id: r.id, first_name: r.first_name, last_name: r.last_name });
    }
  }
  return { voted, notVoted };
}

/** Every vote with its options and committee, for the admin management tab. */
export async function getAdminVotes(): Promise<AdminVote[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("votes")
    .select(
      "*, options:vote_options(id, label, candidate_resident_id, sort_order), committee:vote_committee(resident_id, resident:residents(first_name, last_name))"
    )
    .order("start_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((v: any) => ({
    ...v,
    options: ((v.options ?? []) as VoteOption[]).sort((a, b) => a.sort_order - b.sort_order),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    committee: (v.committee ?? []).map((c: any) => ({
      resident_id: c.resident_id,
      first_name: c.resident?.first_name ?? "",
      last_name: c.resident?.last_name ?? "",
    })),
  })) as AdminVote[];
}
