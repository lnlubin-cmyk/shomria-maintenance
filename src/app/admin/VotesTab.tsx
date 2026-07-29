"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MultiResidentPicker from "./MultiResidentPicker";
import { createVote, updateVoteMeta, deleteVote } from "./vote-actions";
import type { AdminVote } from "@/lib/votes";
import {
  formatDateTime,
  voteState,
  VOTE_STATE_LABELS,
  VOTE_STATE_STYLES,
  VOTE_FORMAT_LABELS,
  type Resident,
} from "@/lib/types";

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
function localInputToIso(v: string): string {
  return v ? new Date(v).toISOString() : "";
}

export default function VotesTab({
  votes,
  residents,
}: {
  votes: AdminVote[];
  residents: Resident[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(p: Promise<{ error: string } | { ok: true }>): Promise<boolean> {
    setError(null);
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (res && "error" in res) {
      setError(res.error);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!adding && (
        <button className="btn-primary mb-6" onClick={() => setAdding(true)}>
          + הצבעה חדשה
        </button>
      )}

      {adding && (
        <div className="mb-6">
          <VoteForm
            residents={residents}
            busy={busy}
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              if (await run(createVote(input))) setAdding(false);
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        {votes.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            אין הצבעות. צרו הצבעה חדשה.
          </p>
        )}

        {votes.map((v) => {
          const state = voteState(v);
          return (
            <div key={v.id} className="rounded-xl border border-gray-200 bg-white p-4">
              {editingId === v.id ? (
                <VoteForm
                  residents={residents}
                  busy={busy}
                  editVote={v}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (input) => {
                    if (
                      await run(
                        updateVoteMeta({
                          id: v.id,
                          title: input.title,
                          description: input.description,
                          subject: input.subject,
                          startAt: input.startAt,
                          closureMode: input.closureMode,
                          closesAt: input.closesAt,
                          allowProxy: input.allowProxy,
                          maxSelections: input.maxSelections,
                        })
                      )
                    )
                      setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{v.title}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${VOTE_STATE_STYLES[state]}`}
                        >
                          {VOTE_STATE_LABELS[state]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-600">{v.subject}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => setEditingId(v.id)}
                      >
                        עריכה
                      </button>
                      <button
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "למחוק את ההצבעה? פעולה זו תמחק את ההצבעה ותוצאותיה לצמיתות."
                            )
                          )
                            run(deleteVote(v.id));
                        }}
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-gray-500 sm:grid-cols-2">
                    <div className="flex gap-1">
                      <dt>סוג:</dt>
                      <dd>{VOTE_FORMAT_LABELS[v.format]}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>בחירות מרביות:</dt>
                      <dd>{v.max_selections}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>נפתחת:</dt>
                      <dd>{formatDateTime(v.start_at)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>נסגרת:</dt>
                      <dd>
                        {v.closure_mode === "scheduled"
                          ? formatDateTime(v.closes_at)
                          : "ידנית"}
                      </dd>
                    </div>
                    <div className="flex gap-1 sm:col-span-2">
                      <dt>אפשרויות:</dt>
                      <dd>{v.options.map((o) => o.label).join(" · ")}</dd>
                    </div>
                    <div className="flex gap-1 sm:col-span-2">
                      <dt>ועדת קלפי:</dt>
                      <dd>
                        {v.committee.map((c) => `${c.first_name} ${c.last_name}`).join(", ") || "—"}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FormInput {
  title: string;
  description: string;
  subject: string;
  format: "options" | "election";
  maxSelections: number;
  startAt: string; // ISO
  closureMode: "manual" | "scheduled";
  closesAt: string | null; // ISO
  allowProxy: boolean;
  optionLabels: string[];
  candidateIds: string[];
  memberIds: string[];
}

function VoteForm({
  residents,
  busy,
  editVote,
  onSubmit,
  onCancel,
}: {
  residents: Resident[];
  busy: boolean;
  editVote?: AdminVote;
  onSubmit: (input: FormInput) => void;
  onCancel: () => void;
}) {
  const isEdit = !!editVote;
  const [title, setTitle] = useState(editVote?.title ?? "");
  const [description, setDescription] = useState(editVote?.description ?? "");
  const [subject, setSubject] = useState(editVote?.subject ?? "");
  const [format, setFormat] = useState<"options" | "election">(editVote?.format ?? "options");
  const [maxSelections, setMaxSelections] = useState(editVote?.max_selections ?? 1);
  const [startAt, setStartAt] = useState(isoToLocalInput(editVote?.start_at ?? null));
  const [closureMode, setClosureMode] = useState<"manual" | "scheduled">(
    editVote?.closure_mode ?? "manual"
  );
  const [closesAt, setClosesAt] = useState(isoToLocalInput(editVote?.closes_at ?? null));
  const [allowProxy, setAllowProxy] = useState(editVote?.allow_proxy_vote ?? true);
  const [optionLabels, setOptionLabels] = useState<string[]>(["", ""]);
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  function submit() {
    onSubmit({
      title,
      description,
      subject,
      format,
      maxSelections: Number(maxSelections),
      startAt: localInputToIso(startAt),
      closureMode,
      closesAt: closureMode === "scheduled" ? localInputToIso(closesAt) : null,
      allowProxy,
      optionLabels,
      candidateIds,
      memberIds,
    });
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
      <h3 className="mb-4 text-lg font-semibold">{isEdit ? "עריכת הצבעה" : "הצבעה חדשה"}</h3>

      <div className="space-y-4">
        <div>
          <label className="label">כותרת ההצבעה *</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">תיאור (רשות)</label>
          <textarea
            className="field"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label">נושא / שאלת ההצבעה *</label>
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">מועד פתיחה *</label>
            <input
              type="datetime-local"
              className="field"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div>
            <label className="label">אופן סגירה *</label>
            <select
              className="field"
              value={closureMode}
              onChange={(e) => setClosureMode(e.target.value as "manual" | "scheduled")}
            >
              <option value="manual">ידנית (ועדת הקלפי סוגרת)</option>
              <option value="scheduled">מתוזמנת (מועד קבוע מראש)</option>
            </select>
          </div>
        </div>

        {closureMode === "scheduled" && (
          <div>
            <label className="label">מועד סגירה *</label>
            <input
              type="datetime-local"
              className="field"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </div>
        )}

        {/* Format + options are fixed after creation. */}
        {!isEdit && (
          <>
            <div>
              <label className="label">סוג ההצבעה *</label>
              <select
                className="field"
                value={format}
                onChange={(e) => setFormat(e.target.value as "options" | "election")}
              >
                <option value="options">אפשרויות מוגדרות מראש</option>
                <option value="election">בחירות (בחירת מועמדים)</option>
              </select>
            </div>

            {format === "options" ? (
              <div>
                <label className="label">אפשרויות (עד 20) *</label>
                <div className="space-y-2">
                  {optionLabels.map((val, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="field"
                        placeholder={`אפשרות ${i + 1}`}
                        value={val}
                        onChange={(e) => {
                          const next = [...optionLabels];
                          next[i] = e.target.value;
                          setOptionLabels(next);
                        }}
                      />
                      {optionLabels.length > 2 && (
                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          onClick={() => setOptionLabels(optionLabels.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {optionLabels.length < 20 && (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-brand-600 hover:underline"
                    onClick={() => setOptionLabels([...optionLabels, ""])}
                  >
                    + הוספת אפשרות
                  </button>
                )}
              </div>
            ) : (
              <div>
                <label className="label">מועמדים *</label>
                <MultiResidentPicker
                  residents={residents}
                  value={candidateIds}
                  onChange={setCandidateIds}
                  max={50}
                  placeholder="חיפוש מועמד לפי שם או ת.ז."
                />
              </div>
            )}
          </>
        )}

        <div>
          <label className="label">מספר בחירות מרבי לכל מצביע *</label>
          <input
            type="number"
            min={1}
            className="field w-32"
            value={maxSelections}
            onChange={(e) => setMaxSelections(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-gray-500">
            1 = בחירה בודדת. יותר מ-1 מאפשר לבחור כמה אפשרויות.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 bg-white p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-brand-500"
            checked={allowProxy}
            onChange={(e) => setAllowProxy(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-gray-800">
              לאפשר לועדת קלפי להזין הצבעה אלקטרונית עבור תושב אחר
            </span>
            <span className="mt-0.5 block text-xs text-gray-500">
              עבור תושב שמתקשה לגשת למערכת. סימון הצבעה בנייר אפשרי בכל מקרה.
            </span>
          </span>
        </label>

        {!isEdit && (
          <div>
            <label className="label">ועדת קלפי (עד 15 חברים) *</label>
            <MultiResidentPicker
              residents={residents}
              value={memberIds}
              onChange={setMemberIds}
              max={15}
              placeholder="חיפוש חבר ועדה לפי שם או ת.ז."
            />
          </div>
        )}
        {isEdit && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            סוג ההצבעה, האפשרויות וועדת הקלפי נקבעים בעת היצירה ואינם ניתנים לעריכה.
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? "שומר…" : isEdit ? "שמירת שינויים" : "יצירת ההצבעה"}
        </button>
        <button className="btn-secondary" disabled={busy} onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}
