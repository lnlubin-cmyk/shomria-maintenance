import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import {
  getVoteById,
  getVoteOptions,
  getVoteCommittee,
  getVoteResults,
  getVoteRoster,
  isCommitteeMember,
  hasResidentVoted,
} from "@/lib/votes";
import AppHeader from "@/components/AppHeader";
import BallotForm from "../BallotForm";
import CommitteePanel from "../CommitteePanel";
import {
  formatDateTime,
  voteState,
  VOTE_STATE_LABELS,
  VOTE_STATE_STYLES,
  VOTE_FORMAT_LABELS,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VotePage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/votes/${params.id}`);

  const vote = await getVoteById(params.id);
  if (!vote) notFound();

  const state = voteState(vote);
  const [options, committee] = await Promise.all([
    getVoteOptions(vote.id),
    getVoteCommittee(vote.id),
  ]);

  const isAdmin = session.user.role === "admin";
  const onCommittee = isAdmin || (await isCommitteeMember(vote.id, session.residentId));
  const alreadyVoted = await hasResidentVoted(vote.id, session.residentId);

  const results = state === "closed" ? await getVoteResults(vote) : null;
  const roster = onCommittee ? await getVoteRoster(vote.id) : null;

  const optionsForBallot = options.map((o) => ({ id: o.id, label: o.label }));

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{vote.title}</h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${VOTE_STATE_STYLES[state]}`}
            >
              {VOTE_STATE_LABELS[state]}
            </span>
          </div>
          {vote.description && <p className="mt-2 text-gray-600">{vote.description}</p>}
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-500 sm:grid-cols-2">
            <div className="flex gap-1">
              <dt>נפתחת:</dt>
              <dd>{formatDateTime(vote.start_at)}</dd>
            </div>
            <div className="flex gap-1">
              <dt>נסגרת:</dt>
              <dd>
                {vote.closed_at
                  ? formatDateTime(vote.closed_at)
                  : vote.closure_mode === "scheduled"
                    ? formatDateTime(vote.closes_at)
                    : "בסגירה ידנית של ועדת הקלפי"}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>סוג:</dt>
              <dd>{VOTE_FORMAT_LABELS[vote.format]}</dd>
            </div>
            {committee.length > 0 && (
              <div className="flex gap-1">
                <dt>ועדת קלפי:</dt>
                <dd>{committee.map((c) => `${c.first_name} ${c.last_name}`).join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* The question */}
        <section className="card">
          <h2 className="text-base font-semibold text-gray-900">{vote.subject}</h2>

          {/* Closed → results */}
          {state === "closed" && results && (
            <div className="mt-4">
              <p className="mb-3 text-sm text-gray-500">
                סה״כ הצביעו: <span className="font-semibold text-gray-800">{results.totalVoters}</span>{" "}
                תושבים
              </p>
              <ResultsBars results={results} />
            </div>
          )}

          {/* Upcoming */}
          {state === "upcoming" && (
            <p className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              ההצבעה תיפתח בתאריך {formatDateTime(vote.start_at)}.
            </p>
          )}

          {/* Open → ballot / already-voted / not-eligible */}
          {state === "open" && (
            <div className="mt-4">
              {alreadyVoted ? (
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  הצבעתך נקלטה. תודה שהשתתפת! התוצאות יתפרסמו עם סיום ההצבעה.
                </p>
              ) : session.residentId ? (
                <BallotForm
                  voteId={vote.id}
                  options={optionsForBallot}
                  maxSelections={vote.max_selections}
                />
              ) : (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  ההצבעה פתוחה לתושבים רשומים בלבד.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Committee management */}
        {onCommittee && roster && (
          <CommitteePanel
            voteId={vote.id}
            canManage={state === "open"}
            options={optionsForBallot}
            maxSelections={vote.max_selections}
            voted={roster.voted}
            notVoted={roster.notVoted}
          />
        )}
      </main>
    </div>
  );
}

function ResultsBars({
  results,
}: {
  results: { options: { id: string; label: string; count: number }[] };
}) {
  const max = Math.max(1, ...results.options.map((o) => o.count));
  return (
    <ul className="space-y-2.5">
      {results.options.map((o) => (
        <li key={o.id}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-800">{o.label}</span>
            <span className="tabular-nums text-gray-600">{o.count}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${(o.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
