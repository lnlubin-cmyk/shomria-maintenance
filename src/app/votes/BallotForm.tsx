"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { castVote } from "./actions";

/**
 * The resident's own ballot. Single-choice renders as radios; a vote that allows
 * several selections renders as checkboxes capped at max_selections. The chosen
 * option is sent once and never returned to the client afterwards.
 */
export default function BallotForm({
  voteId,
  options,
  maxSelections,
}: {
  voteId: string;
  options: { id: string; label: string }[];
  maxSelections: number;
}) {
  const router = useRouter();
  const multi = maxSelections > 1;
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setError(null);
    if (!multi) {
      setSelected([id]);
      return;
    }
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= maxSelections) return cur; // at the cap
      return [...cur, id];
    });
  }

  async function submit() {
    if (selected.length === 0) {
      setError("יש לבחור לפחות אפשרות אחת");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await castVote(voteId, selected);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.refresh(); // re-renders as "already voted / thank you"
  }

  const atCap = multi && selected.length >= maxSelections;

  return (
    <div>
      {multi && (
        <p className="mb-3 text-sm text-gray-600">ניתן לבחור עד {maxSelections} אפשרויות.</p>
      )}
      <ul className="space-y-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          const disabled = busy || (multi && !on && atCap);
          return (
            <li key={o.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                  on ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:bg-gray-50"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name="vote-option"
                  className="h-4 w-4 accent-brand-500"
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggle(o.id)}
                />
                <span className="text-sm font-medium text-gray-800">{o.label}</span>
              </label>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy || selected.length === 0}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {busy ? "שולח…" : "שליחת ההצבעה"}
      </button>
      <p className="mt-2 text-center text-xs text-gray-400">
        ההצבעה חשאית — הבחירה שלך לא נשמרת ולא ניתנת לשיוך אליך.
      </p>
    </div>
  );
}
