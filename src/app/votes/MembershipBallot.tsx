"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { castMembershipVote, castMembershipVoteOnBehalf } from "./actions";

type Decision = "accept" | "decline";

/**
 * Membership ballot: for each candidate name the voter chooses בעד or נגד, with
 * "accept all" / "decline all" shortcuts. Every name must be decided before it
 * can be sent. Reused for the resident's own vote and for a committee member
 * entering a vote on behalf of a resident (onBehalfResidentId).
 */
export default function MembershipBallot({
  voteId,
  options,
  onBehalfResidentId,
  submitLabel = "שליחת ההצבעה",
  onSuccess,
}: {
  voteId: string;
  options: { id: string; label: string }[];
  onBehalfResidentId?: string;
  submitLabel?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decidedCount = options.filter((o) => choices[o.id]).length;
  const allDecided = decidedCount === options.length;

  function setAll(d: Decision) {
    setError(null);
    setChoices(Object.fromEntries(options.map((o) => [o.id, d])));
  }
  function setOne(id: string, d: Decision) {
    setError(null);
    setChoices((c) => ({ ...c, [id]: d }));
  }

  async function submit() {
    if (!allDecided) {
      setError("יש להצביע בעד או נגד עבור כל המועמדים");
      return;
    }
    setError(null);
    setBusy(true);
    const decisions = options.map((o) => ({ optionId: o.id, accept: choices[o.id] === "accept" }));
    const res = onBehalfResidentId
      ? await castMembershipVoteOnBehalf(voteId, onBehalfResidentId, decisions)
      : await castMembershipVote(voteId, decisions);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onSuccess?.();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          יש להצביע בעד או נגד עבור כל מועמד ({decidedCount}/{options.length}).
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAll("accept")}
            className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            אישור הכל
          </button>
          <button
            type="button"
            onClick={() => setAll("decline")}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            דחיית הכל
          </button>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
        {options.map((o) => {
          const d = choices[o.id];
          return (
            <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="text-sm font-medium text-gray-800">{o.label}</span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOne(o.id, "accept")}
                  className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                    d === "accept"
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 text-gray-600 hover:bg-emerald-50"
                  }`}
                >
                  בעד
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOne(o.id, "decline")}
                  className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                    d === "decline"
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-gray-300 text-gray-600 hover:bg-red-50"
                  }`}
                >
                  נגד
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || !allDecided}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {busy ? "שולח…" : submitLabel}
      </button>
      {!onBehalfResidentId && (
        <p className="mt-2 text-center text-xs text-gray-400">
          ההצבעה חשאית — הבחירה שלך לא נשמרת ולא ניתנת לשיוך אליך.
        </p>
      )}
    </div>
  );
}
