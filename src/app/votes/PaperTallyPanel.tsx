"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitPaperCounts, submitMembershipPaperCounts, approvePaperCounts } from "./actions";
import type {
  VoteFormat,
  VoteOptionOutcome,
  PaperTallyState,
  VoteCommitteeMember,
} from "@/lib/types";
import { formatDateTime } from "@/lib/types";

/**
 * Post-closure manual counting for ועדת קלפי. A member enters the counted manual
 * votes per option (for a membership vote, בעד + נגד per candidate); every
 * committee member must then approve before the counts are added to the results.
 * Re-entry resets the approvals.
 */
export default function PaperTallyPanel({
  voteId,
  format,
  options,
  paper,
  committee,
  amCommittee,
  iApproved,
}: {
  voteId: string;
  format: VoteFormat;
  options: VoteOptionOutcome[];
  paper: PaperTallyState;
  committee: VoteCommitteeMember[];
  amCommittee: boolean;
  iApproved: boolean;
}) {
  const router = useRouter();
  const isMembership = format === "membership";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!paper.submissionExists);
  const [acc, setAcc] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.id, String(paper.counts[o.id] ?? 0)]))
  );
  const [dec, setDec] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.id, String(paper.declineCounts[o.id] ?? 0)]))
  );

  const enteredTotal = useMemo(
    () =>
      options.reduce(
        (s, o) => s + (Number(acc[o.id]) || 0) + (isMembership ? Number(dec[o.id]) || 0 : 0),
        0
      ),
    [acc, dec, options, isMembership]
  );

  function invalid(v: string) {
    const n = Number(v);
    return !Number.isInteger(n) || n < 0;
  }

  async function save() {
    for (const o of options) {
      if (invalid(acc[o.id]) || (isMembership && invalid(dec[o.id]))) {
        setError(`ערך לא תקין עבור "${o.label}"`);
        return;
      }
    }
    setError(null);
    setBusy(true);
    const res = isMembership
      ? await submitMembershipPaperCounts(
          voteId,
          options.map((o) => ({
            optionId: o.id,
            accept: Math.trunc(Number(acc[o.id]) || 0),
            decline: Math.trunc(Number(dec[o.id]) || 0),
          }))
        )
      : await submitPaperCounts(
          voteId,
          options.map((o) => ({ optionId: o.id, count: Math.trunc(Number(acc[o.id]) || 0) }))
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
      <h2 className="text-lg font-semibold text-gray-900">ספירת קולות ידנית</h2>
      <p className="mt-1 text-sm text-gray-600">
        {paper.paperVoters > 0
          ? `סומנו ${paper.paperVoters} הצבעות ידניות. יש לספור את הקולות ולהזין את מספרם.`
          : "לא סומנו הצבעות ידניות. אם נערכה הצבעה ידנית, ניתן להזין את תוצאות הספירה כאן."}
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Entry form */}
      {editing ? (
        <div className="mt-4 space-y-2">
          {options.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">{o.label}</span>
              {isMembership ? (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    בעד
                    <input
                      type="number"
                      min={0}
                      className="field w-20"
                      value={acc[o.id] ?? "0"}
                      onChange={(e) => setAcc((c) => ({ ...c, [o.id]: e.target.value }))}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-gray-500">
                    נגד
                    <input
                      type="number"
                      min={0}
                      className="field w-20"
                      value={dec[o.id] ?? "0"}
                      onChange={(e) => setDec((c) => ({ ...c, [o.id]: e.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">אלקטרוני: {o.electronic}</span>
                  <input
                    type="number"
                    min={0}
                    className="field w-24"
                    value={acc[o.id] ?? "0"}
                    onChange={(e) => setAcc((c) => ({ ...c, [o.id]: e.target.value }))}
                  />
                </span>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
            <span>סה״כ קולות ידניים שהוזנו:</span>
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
                  <th className="pb-1 text-right font-medium">{isMembership ? "מועמד" : "אפשרות"}</th>
                  {isMembership ? (
                    <>
                      <th className="pb-1 text-left font-medium tabular-nums">בעד</th>
                      <th className="pb-1 text-left font-medium tabular-nums">נגד</th>
                    </>
                  ) : (
                    <>
                      <th className="pb-1 text-left font-medium tabular-nums">אלקטרוני</th>
                      <th className="pb-1 text-left font-medium tabular-nums">ידני</th>
                      <th className="pb-1 text-left font-medium tabular-nums">סה״כ</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {options.map((o) => {
                  const pAcc = paper.counts[o.id] ?? 0;
                  const pDec = paper.declineCounts[o.id] ?? 0;
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="py-1.5 font-medium text-gray-800">{o.label}</td>
                      {isMembership ? (
                        <>
                          <td className="py-1.5 text-left tabular-nums text-emerald-700">
                            {o.electronic + pAcc}
                          </td>
                          <td className="py-1.5 text-left tabular-nums text-red-700">
                            {o.declineElectronic + pDec}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5 text-left tabular-nums text-gray-600">{o.electronic}</td>
                          <td className="py-1.5 text-left tabular-nums text-gray-600">{pAcc}</td>
                          <td className="py-1.5 text-left font-semibold tabular-nums text-gray-800">
                            {o.electronic + pAcc}
                          </td>
                        </>
                      )}
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
