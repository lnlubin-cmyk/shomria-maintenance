import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getAllVotes } from "@/lib/votes";
import AppHeader from "@/components/AppHeader";
import {
  formatDateTime,
  voteState,
  VOTE_STATE_LABELS,
  VOTE_STATE_STYLES,
  type Vote,
  type VoteState,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function VoteCard({ vote }: { vote: Vote }) {
  const state = voteState(vote);
  return (
    <div>
      <Link
        href={`/votes/${vote.id}`}
        className="card block transition hover:border-brand-200 hover:shadow-md"
      >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">{vote.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${VOTE_STATE_STYLES[state]}`}
        >
          {VOTE_STATE_LABELS[state]}
        </span>
      </div>
      {vote.description && <p className="mt-1 text-sm text-gray-600">{vote.description}</p>}
      <dl className="mt-3 space-y-1 text-sm text-gray-500">
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
      </dl>
        <div className="mt-3 text-sm font-medium text-brand-600">
          {state === "open" ? "להצבעה ←" : state === "closed" ? "לצפייה בתוצאות ←" : "לפרטים ←"}
        </div>
      </Link>
      {state === "closed" && (
        <div className="mt-1 px-1">
          <Link
            href={`/votes/${vote.id}/protocol`}
            className="text-xs font-medium text-gray-500 hover:text-brand-600 hover:underline"
          >
            פרוטוקול ההצבעה ←
          </Link>
        </div>
      )}
    </div>
  );
}

export default async function VotesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/votes");

  const votes = await getAllVotes();
  const groups: Record<VoteState, Vote[]> = { open: [], upcoming: [], closed: [] };
  for (const v of votes) groups[voteState(v)].push(v);

  const sections: { state: VoteState; title: string }[] = [
    { state: "open", title: "הצבעות פעילות" },
    { state: "upcoming", title: "הצבעות עתידיות" },
    { state: "closed", title: "הצבעות שהסתיימו — תוצאות" },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">הצבעות</h1>
        <p className="mb-6 text-sm text-gray-600">
          הצבעות פעילות, עתידיות, ותוצאות של הצבעות שהסתיימו.
        </p>

        {votes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            אין הצבעות במערכת.
          </p>
        ) : (
          <div className="space-y-8">
            {sections.map(({ state, title }) =>
              groups[state].length > 0 ? (
                <section key={state}>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {title}
                  </h2>
                  <div className="space-y-3">
                    {groups[state].map((v) => (
                      <VoteCard key={v.id} vote={v} />
                    ))}
                  </div>
                </section>
              ) : null
            )}
          </div>
        )}
      </main>
    </div>
  );
}
