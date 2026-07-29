"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitPaperCounts, approvePaperCounts } from "./actions";
import type { VoteOptionOutcome, PaperTallyState, VoteCommitteeMember } from "@/lib/types";
import { formatDateTime } from "@/lib/types";

/**
 * Post-closure manual paper counting for ועדת קלפי. A member enters the counted
 * paper votes per option; every committee member must then approve before the
 * counts are added to the published results. Re-entry resets the approvals.
 */
export default function PaperTallyPanel({
  voteId,
  options,
  paper,
  committee,
  amCommittee,
  iApproved,
}: {
  voteId: string;
  options: VoteOptionOutcome[];
  paper: PaperTallyState;
  committee: VoteCommitteeMember[];
  amCommittee: boolean; // current user is a ועדת קלפי member (may approve)
  iApproved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!paper.submissionExists);
  const [counts, setCounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.id, String(paper.counts[o.id] ?? 0)]))
  );

  const enteredTotal = useMemo(
    () => options.reduce((s, o) => s + (Number(counts[o.id]) || 0), 0),
    [counts, options]
  );

  async function save() {
    for (const o of options) {
      const n = Number(counts[o.id]);
      if (!Number.isInteger(n) || n < 0) {
        setError(`ערך לא תקין עבור "${o.label}"`);
        return;
      }
    }
    setError(null);
    setBusy(true);
    const res = await submitPaperCounts(
      voteId,
      options.map((o) => ({ optionId: o.id, count: Math.trunc(Number(counts[o.id]) || 0) }))
    );
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function approve() {
    setError(null);
    setBusy(true);
    const res = await approvePaperCounts(voteId);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const approvedSet = new Set(paper.approvedResidentIds);

  return (
    <section className="card border-amber-200 bg-amber-50/40">
      <h2 className="text-lg font-semibold text-gray-900">ספירת קולות בנייר</h2>
      <p className="mt-1 text-sm text-gray-600">
        {paper.paperVoters > 0
          ? `סומנו ${paper.paperVoters} הצבעות בנייר. יש לספור את הפתקים ולהזין את מספר הקולות לכל אפשרות.`
          : "לא סומנו הצבעות בנייר. אם נערכה הצבעה בנייר, ניתן להזין את תוצאות הספירה כאן."}
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Entry form */}
      {editing ? (
        <div className="mt-4 space-y-2">
          {options.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-800">
                {o.label}
                <span className="ms-2 text-xs font-normal text-gray-400">
                  אלקטרוני: {o.electronic}
                </span>
              </span>
              <input
                type="number"
                min={0}
                className="field w-28"
                value={counts[o.id] ?? "0"}
                onChange={(e) => setCounts((c) => ({ ...c, [o.id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
            <span>סה״כ קולות בנייר שהוזנו:</span>
            <span className="tabular-nums font-medium text-gray-700">{enteredTotal}</span>
          </div>
          {paper.submissionExists && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
              עדכון הספירה יאפס את כל האישורים הקיימים ויידרש אישור מחדש מכל חברי הוועדה.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-50">
              {busy ? "שומר…" : paper.submissionExists ? "עדכון הספירה" : "שמירת הספירה"}
            </button>
            {paper.submissionExists && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={busy}
                className="btn-secondary"
              >
                ביטול
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-1 text-right font-medium">אפשרות</th>
                  <th className="pb-1 text-left font-medium tabular-nums">אלקטרוני</th>
                  <th className="pb-1 text-left font-medium tabular-nums">נייר</th>
                  <th className="pb-1 text-left font-medium tabular-nums">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {options.map((o) => {
                  const p = paper.counts[o.id] ?? 0;
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="py-1.5 font-medium text-gray-800">{o.label}</td>
                      <td className="py-1.5 text-left tabular-nums text-gray-600">{o.electronic}</td>
                      <td className="py-1.5 text-left tabular-nums text-gray-600">{p}</td>
                      <td className="py-1.5 text-left font-semibold tabular-nums text-gray-800">
                        {o.electronic + p}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 text-sm font-medium text-brand-600 hover:underline"
          >
            עריכת הספירה
          </button>
        </div>
      )}

      {/* Approval status */}
      {paper.submissionExists && (
        <div className="mt-5 border-t border-amber-200 pt-4">
          <div className="text-sm text-gray-600">
            הוזן על ידי {paper.enteredByName ?? "—"}
            {paper.enteredAt ? ` · ${formatDateTime(paper.enteredAt)}` : ""}
          </div>

          {paper.finalized ? (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              הספירה אושרה על ידי כל חברי ועדת הקלפי — התוצאות הסופיות פורסמו.
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600">
              אישרו {paper.approvedResidentIds.length} מתוך {paper.committeeSize} חברי הוועדה.
            </p>
          )}

          <ul className="mt-3 space-y-1">
            {committee.map((c) => {
              const ok = approvedSet.has(c.resident_id);
              return (
                <li key={c.resident_id} className="flex items-center gap-2 text-sm">
                  <span className={ok ? "text-emerald-600" : "text-gray-300"}>{ok ? "✓" : "○"}</span>
                  <span className={ok ? "text-gray-800" : "text-gray-500"}>
                    {c.first_name} {c.last_name}
                  </span>
                </li>
              );
            })}
          </ul>

          {amCommittee && !paper.finalized && !editing && (
            <div className="mt-4">
              {iApproved ? (
                <p className="text-sm text-gray-500">אישרת את הספירה. ממתין לאישור שאר החברים.</p>
              ) : (
                <button type="button" onClick={approve} disabled={busy} className="btn-primary disabled:opacity-50">
                  {busy ? "מאשר…" : "אישור הספירה"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
