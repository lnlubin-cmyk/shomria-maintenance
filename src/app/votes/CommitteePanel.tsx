"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { castVoteOnBehalf, markPaperVote, closeVote } from "./actions";
import type { VoteRosterEntry } from "@/lib/types";

/**
 * ועדת קלפי management for an open vote: close it, help a resident vote
 * (electronically on their behalf — only when the admin enabled it — or by
 * marking a paper ballot), and track turnout. Turnout shows participation only,
 * never how anyone voted.
 */
export default function CommitteePanel({
  voteId,
  canManage,
  allowProxy,
  options,
  maxSelections,
  voted,
  notVoted,
}: {
  voteId: string;
  canManage: boolean; // vote is open — closing and helping to vote are allowed
  allowProxy: boolean;
  options: { id: string; label: string }[];
  maxSelections: number;
  voted: VoteRosterEntry[];
  notVoted: VoteRosterEntry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showEntry, setShowEntry] = useState(false);
  const [residentId, setResidentId] = useState("");
  const [residentName, setResidentName] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const [showVoted, setShowVoted] = useState(false);
  const [showNotVoted, setShowNotVoted] = useState(false);

  const multi = maxSelections > 1;
  const total = voted.length + notVoted.length;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? notVoted.filter(
          (r) =>
            `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || r.resident_id.includes(q)
        )
      : notVoted;
    return base.slice(0, 30);
  }, [notVoted, query]);

  function resetEntry() {
    setResidentId("");
    setResidentName("");
    setQuery("");
    setPicked([]);
  }

  function toggleOption(id: string) {
    setError(null);
    if (!multi) {
      setPicked([id]);
      return;
    }
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxSelections) return cur;
      return [...cur, id];
    });
  }

  async function withBusy(p: Promise<{ error: string } | { ok: true }>, ok: string) {
    setError(null);
    setMsg(null);
    setBusy(true);
    const res = await p;
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setMsg(ok);
    resetEntry();
    setShowEntry(false);
    router.refresh();
  }

  async function close() {
    if (!confirm("לסגור את ההצבעה? לאחר הסגירה לא ניתן יהיה להצביע והתוצאות ייחשפו.")) return;
    setError(null);
    setMsg(null);
    setBusy(true);
    const res = await closeVote(voteId);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const atCap = multi && picked.length >= maxSelections;

  return (
    <section className="card border-brand-100 bg-brand-50/40">
      <h2 className="text-lg font-semibold text-gray-900">ועדת קלפי — ניהול ההצבעה</h2>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>
      )}

      {/* Close */}
      {canManage && (
        <div className="mt-4">
          <button type="button" onClick={close} disabled={busy} className="btn-danger disabled:opacity-50">
            סגירת ההצבעה
          </button>
          <p className="mt-1 text-xs text-gray-500">
            סגירה מיידית של ההצבעה. לאחריה לא ניתן להצביע והתוצאות נחשפות.
          </p>
        </div>
      )}

      {/* Help a resident vote: proxy (if enabled) and/or mark a paper ballot */}
      {canManage && (
        <div className="mt-5 border-t border-brand-100 pt-4">
          {!showEntry ? (
            <button type="button" onClick={() => setShowEntry(true)} className="btn-secondary">
              רישום הצבעה עבור תושב
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-medium text-gray-900">רישום הצבעה עבור תושב</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowEntry(false);
                    resetEntry();
                  }}
                  className="text-sm text-gray-500 hover:underline"
                >
                  ביטול
                </button>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                עבור תושב שאינו יכול להצביע בעצמו. התושב יסומן כמי שהצביע ולא יוכל להצביע שוב.
              </p>

              <label className="label">תושב</label>
              <input
                className="field"
                placeholder="חיפוש לפי שם או ת.ז. (מתוך מי שטרם הצביעו)"
                value={query}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setResidentId("");
                  setResidentName("");
                }}
              />
              {query.trim() && !residentId && (
                <ul className="mt-1 max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  {matches.map((r) => (
                    <li key={r.resident_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setResidentId(r.resident_id);
                          setResidentName(`${r.first_name} ${r.last_name}`);
                          setQuery(`${r.first_name} ${r.last_name}`);
                        }}
                        className="block w-full px-3 py-1.5 text-right text-sm hover:bg-brand-50"
                      >
                        {r.first_name} {r.last_name}
                        <span className="text-gray-400" dir="ltr">
                          {" "}
                          · {r.resident_id}
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו תושבים שטרם הצביעו.</li>
                  )}
                </ul>
              )}

              {residentId && (
                <div className="mt-4 space-y-4">
                  {/* Option A: electronic proxy vote (only if enabled) */}
                  {allowProxy && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 text-sm font-medium text-gray-800">
                        הזנת בחירה אלקטרונית{multi ? ` (עד ${maxSelections})` : ""}
                      </div>
                      <ul className="space-y-2">
                        {options.map((o) => {
                          const on = picked.includes(o.id);
                          const disabled = busy || (multi && !on && atCap);
                          return (
                            <li key={o.id}>
                              <label
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition ${
                                  on ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:bg-gray-50"
                                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                              >
                                <input
                                  type={multi ? "checkbox" : "radio"}
                                  name="onbehalf-option"
                                  className="h-4 w-4 accent-brand-500"
                                  checked={on}
                                  disabled={disabled}
                                  onChange={() => toggleOption(o.id)}
                                />
                                <span className="font-medium text-gray-800">{o.label}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        type="button"
                        onClick={() =>
                          withBusy(
                            castVoteOnBehalf(voteId, residentId, picked),
                            "ההצבעה נקלטה ונרשמה עבור התושב."
                          )
                        }
                        disabled={busy || picked.length === 0}
                        className="btn-primary mt-3 disabled:opacity-50"
                      >
                        {busy ? "שולח…" : "רישום הבחירה"}
                      </button>
                    </div>
                  )}

                  {/* Option B: mark a paper ballot (always available) */}
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="mb-1 text-sm font-medium text-gray-800">סימון הצבעה בנייר</div>
                    <p className="mb-2 text-xs text-gray-500">
                      התושב הצביע בפתק. סימון בלבד — הקולות ייספרו ידנית לאחר סגירת ההצבעה.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        withBusy(
                          markPaperVote(voteId, residentId),
                          `${residentName} סומן/ה כמי שהצביע/ה בנייר.`
                        )
                      }
                      disabled={busy}
                      className="btn-secondary disabled:opacity-50"
                    >
                      {busy ? "רושם…" : "סימון הצבעה בנייר"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Turnout */}
      <div className="mt-5 border-t border-brand-100 pt-4">
        <div className="text-sm font-medium text-gray-700">
          מעקב הצבעה: <span className="text-brand-700">{voted.length}</span> מתוך {total} תושבים
          הצביעו
        </div>

        <div className="mt-3 space-y-3">
          <Roster
            title={`הצביעו (${voted.length})`}
            open={showVoted}
            onToggle={() => setShowVoted((v) => !v)}
            entries={voted}
            showMethod
          />
          <Roster
            title={`טרם הצביעו (${notVoted.length})`}
            open={showNotVoted}
            onToggle={() => setShowNotVoted((v) => !v)}
            entries={notVoted}
          />
        </div>
      </div>
    </section>
  );
}

const METHOD_BADGE: Record<string, string> = {
  proxy: "נרשם ע״י ועדת קלפי",
  paper: "הצביע/ה בנייר",
};

function Roster({
  title,
  open,
  onToggle,
  entries,
  showMethod = false,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  entries: VoteRosterEntry[];
  showMethod?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-800"
      >
        {title}
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="max-h-64 divide-y divide-gray-100 overflow-auto border-t border-gray-100">
          {entries.map((r) => (
            <li key={r.resident_id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {r.first_name} {r.last_name}
              </span>
              {showMethod && r.method && METHOD_BADGE[r.method] && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {METHOD_BADGE[r.method]}
                </span>
              )}
            </li>
          ))}
          {entries.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">אין תושבים ברשימה זו.</li>
          )}
        </ul>
      )}
    </div>
  );
}
