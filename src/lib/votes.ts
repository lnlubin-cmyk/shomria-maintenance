import { createAdminClient } from "@/lib/supabase/server";
import {
  isVoteOpen,
  voteState,
  type Vote,
  type VoteOption,
  type VoteCommitteeMember,
  type VoteResults,
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
 * The results of a vote — the per-option counts and turnout. Returns null while
 * the vote is still open or upcoming: results are never revealed before closure.
 * Election results are ordered by count (winners first); option votes keep the
 * admin's order.
 */
export async function getVoteResults(vote: Vote): Promise<VoteResults | null> {
  if (voteState(vote) !== "closed") return null;

  const admin = createAdminClient();
  const { data: options } = await admin
    .from("vote_options")
    .select("id, label, sort_order")
    .eq("vote_id", vote.id)
    .order("sort_order");
  const opts = options ?? [];
  const ids = opts.map((o) => o.id);

  const { data: tallies } = ids.length
    ? await admin.from("vote_tallies").select("option_id, count").in("option_id", ids)
    : { data: [] as { option_id: string; count: number }[] };
  const countById = new Map((tallies ?? []).map((t) => [t.option_id, t.count]));

  const { count: totalVoters } = await admin
    .from("vote_participants")
    .select("*", { count: "exact", head: true })
    .eq("vote_id", vote.id);

  let lines = opts.map((o) => ({ id: o.id, label: o.label, count: countById.get(o.id) ?? 0 }));
  if (vote.format === "election") lines = lines.sort((a, b) => b.count - a.count);

  return { totalVoters: totalVoters ?? 0, options: lines };
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
    admin.from("vote_participants").select("resident_id, voted_by_user_id").eq("vote_id", voteId),
    admin.from("residents").select("id, first_name, last_name").order("last_name"),
  ]);

  const votedBy = new Map(
    (parts ?? []).map((p) => [p.resident_id, p.voted_by_user_id as string | null])
  );
  const voted: VoteRosterEntry[] = [];
  const notVoted: VoteRosterEntry[] = [];

  for (const r of residents ?? []) {
    if (votedBy.has(r.id)) {
      voted.push({
        resident_id: r.id,
        first_name: r.first_name,
        last_name: r.last_name,
        by_self: !votedBy.get(r.id),
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
