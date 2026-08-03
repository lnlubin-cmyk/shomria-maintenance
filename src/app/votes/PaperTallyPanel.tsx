"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPaperCounts, submitMembershipPaperCounts, approvePaperCounts } from "./actions";
import {
  formatDateTime,
  VOTE_APPROVAL_STATEMENT,
  type VoteFormat,
  type VoteOptionOutcome,
  type PaperTallyState,
  type VoteCommitteeMember,
} from "@/lib/types";

/**
 * Committee finalization after closure. Closing stops electronic voting but does
 * NOT publish results. The committee reviews the (still-private) results, enters
 * the paper-slip (פתק) count once if manual voting was enabled, and every member
 * confirms an honesty declaration. Results publish only when all have confirmed.
 */
export default function PaperTallyPanel({
  voteId,
  format,
  allowPaper,
  maxSelections,
  options,
  paper,
  committee,
  amCommittee,
  iApproved,
}: {
  voteId: string;
  format: VoteFormat;
  allowPaper: boolean;
  maxSelections: number;
  options: VoteOptionOutcome[];
  paper: PaperTallyState;
  committee: VoteCommitteeMember[];
  amCommittee: boolean;
  iApproved: boolean;
}) {
  const router = useRouter();
  const isMembership = format === "membership";
  const singleChoice = !isMembership && maxSelections === 1;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The count is entered once; open the form if paper voters were marked.
  const [showEntry, setShowEntry] = useState(paper.paperVoters > 0 && !paper.submissionExists);
  const [confirmed, setConfirmed] = useState(false);
  const [acc, setAcc] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.id, String(paper.counts[o.id] ?? 0)]))
  );
  const [dec, setDec] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.id, String(paper.declineCounts[o.id] ?? 0)]))
  );
  const [manualVoters, setManualVoters] = useState("0");

  const invalid = (v: string) => {
    const n = Number(v);
    return !Number.isInteger(n) || n < 0;
  };

  // The number of paper voters is derived from the counts where it's determined
  // (single-choice = sum, membership = the per-candidate total); only multi-select
  // needs it entered explicitly.
  function derivedManualVoters(): number | null {
    if (isMembership) {
      return Math.max(0, ...options.map((o) => (Number(acc[o.id]) || 0) + (Number(dec[o.id]) || 0)));
    }
    if (singleChoice) {
      return options.reduce((s, o) => s + (Number(acc[o.id]) || 0), 0);
    }
    return null;
  }

  async function saveCounts() {
    for (const o of options) {
      if (invalid(acc[o.id]) || (isMembership && invalid(dec[o.id]))) {
        setError(`ערך לא תקין עבור "${o.label}"`);
        return;
      }
    }
    const derived = derivedManualVoters();
    const mv = derived !== null ? derived : Math.trunc(Number(manualVoters) || 0);
    setError(null);
    setBusy(true);
    const res = isMembership
      ? await submitMembershipPaperCounts(
          voteId,
          options.map((o) => ({
            optionId: o.id,
            accept: Math.trunc(Number(acc[o.id]) || 0),
            decline: Math.trunc(Number(dec[o.id]) || 0),
          })),
          mv
        )
      : await submitPaperCounts(
          voteId,
          options.map((o) => ({ optionId: o.id, count: Math.trunc(Number(acc[o.id]) || 0) })),
          mv
        );
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setShowEntry(false);
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
  const paperTotal = Math.max(paper.paperVoters, paper.submittedManualVoters);
  const derived = derivedManualVoters();

  return (
    <section className="card border-amber-200 bg-amber-50/40">
      <h2 className="text-lg font-semibold text-gray-900">סיום ההצבעה ואישור התוצאות</h2>
      <p className="mt-1 text-sm text-gray-600">
        ההצבעה במערכת נסגרה. {allowPaper ? "יש להזין את ספירת קולות הפתקים (אם הייתה הצבעה בפתק), " : ""}
        לבדוק את התוצאות, וכל חברי ועדת הקלפי מאשרים אותן. התוצאות יפורסמו רק לאחר אישור כל החברים.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Results preview (private to the committee) */}
      <div className="mt-4 border-t border-amber-200 pt-4">
        <h3 className="mb-2 font-semibold text-gray-800">תוצאות (טרם פורסמו)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="pb-1 text-right font-medium">{isMembership ? "מועמד" : "אפשרות"}</th>
                <th className="pb-1 text-left font-medium tabular-nums">מערכת</th>
                <th className="pb-1 text-left font-medium tabular-nums">פתק</th>
                <th className="pb-1 text-left font-medium tabular-nums">
                  {isMembership ? "בעד / נגד" : "סה״כ"}
                </th>
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
                        <td className="py-1.5 text-left tabular-nums text-gray-600">
                          {o.electronic} / {o.declineElectronic}
                        </td>
                        <td className="py-1.5 text-left tabular-nums text-gray-600">
                          {pAcc} / {pDec}
                        </td>
                        <td className="py-1.5 text-left font-semibold tabular-nums text-gray-800">
                          {o.electronic + pAcc} / {o.declineElectronic + pDec}
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
      </div>

      {/* Paper-slip (פתק) count entry — only when enabled; entered once */}
      {allowPaper && (
        <div className="mt-5 border-t border-amber-200 pt-4">
          <h3 className="mb-2 font-semibold text-gray-800">ספירת קולות פתקים</h3>
          {paper.submissionExists ? (
            <p className="text-sm text-gray-600">
              הוזנו {paperTotal} מצביעים בפתק
              {paper.enteredByName ? ` · עודכן ע״י ${paper.enteredByName}` : ""}
              {paper.enteredAt ? ` · ${formatDateTime(paper.enteredAt)}` : ""}. הספירה סופית ואינה
              ניתנת לשינוי.
            </p>
          ) : !showEntry ? (
            <button
              type="button"
              onClick={() => setShowEntry(true)}
              className="btn-secondary"
            >
              הזנת ספירת קולות פתקים
            </button>
          ) : (
            <div className="space-y-2">
              {derived === null && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2">
                  <span className="text-sm font-medium text-gray-800">
                    מספר המצביעים בפתק
                    <span className="ms-2 text-xs font-normal text-gray-500">(סה״כ פתקים)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="field w-24"
                    value={manualVoters}
                    onChange={(e) => setManualVoters(e.target.value)}
                  />
                </div>
              )}
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
                    <input
                      type="number"
                      min={0}
                      className="field w-24"
                      value={acc[o.id] ?? "0"}
                      onChange={(e) => setAcc((c) => ({ ...c, [o.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              {derived !== null && (
                <div className="flex items-center justify-between pt-1 text-sm text-gray-500">
                  <span>מספר המצביעים בפתק:</span>
                  <span className="tabular-nums font-medium text-gray-700">{derived}</span>
                </div>
              )}
              <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
                שימו לב: ספירת הקולות מוזנת פעם אחת ואינה ניתנת לעריכה לאחר השמירה.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={saveCounts} disabled={busy} className="btn-primary disabled:opacity-50">
                  {busy ? "שומר…" : "שמירת הספירה"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEntry(false);
                    setError(null);
                  }}
                  disabled={busy}
                  className="btn-secondary"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation & approval */}
      <div className="mt-5 border-t border-amber-200 pt-4">
        <h3 className="mb-2 font-semibold text-gray-800">אישור התוצאות</h3>

        {paper.finalized ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            כל חברי ועדת הקלפי אישרו — התוצאות פורסמו.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
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

        {amCommittee && !paper.finalized && !showEntry && (
          <div className="mt-4">
            {iApproved ? (
              <p className="text-sm text-gray-500">אישרת את התוצאות. ממתין לאישור שאר החברים.</p>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-brand-500"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>{VOTE_APPROVAL_STATEMENT}</span>
                </label>
                <button
                  type="button"
                  onClick={approve}
                  disabled={busy || !confirmed}
                  className="btn-primary mt-3 disabled:opacity-50"
                >
                  {busy ? "מאשר…" : "אישור התוצאות ופרסומן"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
