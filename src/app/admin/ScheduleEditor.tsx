"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRAYER_TITLES,
  type Minyan,
  type Prayer,
  type PrayerSchedule,
  type PrayerTitle,
} from "@/lib/prayer-times";
import { saveSchedule } from "./prayer-actions";

interface Draft {
  id?: string;
  title: string;
  is_visible: boolean;
  prayers: Prayer[];
}

const emptyMinyan = (): Minyan => ({ name: "", time: "", notes: "", is_visible: true });
const emptyPrayer = (): Prayer => ({ title: "שחרית", custom_title: "", minyanim: [emptyMinyan()] });

export default function ScheduleEditor({
  schedule,
  onDone,
}: {
  schedule: PrayerSchedule | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(
    schedule
      ? { id: schedule.id, title: schedule.title, is_visible: schedule.is_visible, prayers: schedule.prayers }
      : { title: "", is_visible: true, prayers: [emptyPrayer()] }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- nested immutable updaters ---
  const setPrayers = (fn: (p: Prayer[]) => Prayer[]) => setDraft((d) => ({ ...d, prayers: fn(d.prayers) }));
  const patchPrayer = (pi: number, patch: Partial<Prayer>) =>
    setPrayers((ps) => ps.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  const patchMinyan = (pi: number, mi: number, patch: Partial<Minyan>) =>
    setPrayers((ps) =>
      ps.map((p, i) =>
        i !== pi ? p : { ...p, minyanim: p.minyanim.map((m, j) => (j === mi ? { ...m, ...patch } : m)) }
      )
    );
  const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = arr.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  async function submit() {
    setError(null);
    setBusy(true);
    const result = await saveSchedule(draft);
    setBusy(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <div className="card space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <h2 className="font-semibold">{draft.id ? "עריכת לוח תפילות" : "לוח תפילות חדש"}</h2>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <label className="label">כותרת הלוח</label>
          <input
            className="field"
            placeholder="לדוגמה: יום חול"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={draft.is_visible}
            onChange={(e) => setDraft((d) => ({ ...d, is_visible: e.target.checked }))}
          />
          מוצג לתושבים
        </label>
      </div>

      {/* Prayers */}
      <div className="space-y-4">
        {draft.prayers.map((p, pi) => (
          <div key={pi} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="label">תפילה</label>
                <select
                  className="field"
                  value={p.title}
                  onChange={(e) => patchPrayer(pi, { title: e.target.value as PrayerTitle })}
                >
                  {PRAYER_TITLES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {p.title === "אחר" && (
                <div className="flex-1">
                  <label className="label">כותרת חופשית</label>
                  <input
                    className="field"
                    placeholder="שם התפילה"
                    value={p.custom_title}
                    onChange={(e) => patchPrayer(pi, { custom_title: e.target.value })}
                  />
                </div>
              )}
              <div className="ml-auto flex items-center gap-2 pb-1 text-sm">
                <button type="button" className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={pi === 0}
                  onClick={() => setPrayers((ps) => move(ps, pi, -1))} title="הזז מעלה">▲</button>
                <button type="button" className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={pi === draft.prayers.length - 1}
                  onClick={() => setPrayers((ps) => move(ps, pi, 1))} title="הזז מטה">▼</button>
                <button type="button" className="text-red-600 hover:underline"
                  onClick={() => setPrayers((ps) => ps.filter((_, i) => i !== pi))}>הסר תפילה</button>
              </div>
            </div>

            {/* Minyanim */}
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold uppercase text-gray-500">מניינים</div>
              {p.minyanim.map((m, mi) => (
                <div key={mi} className="grid items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-[1fr_100px_1fr_auto]">
                  <input className="field" placeholder="שם המניין (למשל: מניין ראשון)" value={m.name}
                    onChange={(e) => patchMinyan(pi, mi, { name: e.target.value })} />
                  <input className="field" placeholder="שעה" dir="ltr" value={m.time}
                    onChange={(e) => patchMinyan(pi, mi, { time: e.target.value })} />
                  <input className="field" placeholder="הערות" value={m.notes}
                    onChange={(e) => patchMinyan(pi, mi, { notes: e.target.value })} />
                  <div className="flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-1 text-xs text-gray-600" title="מוצג">
                      <input type="checkbox" className="h-4 w-4" checked={m.is_visible}
                        onChange={(e) => patchMinyan(pi, mi, { is_visible: e.target.checked })} />
                      מוצג
                    </label>
                    <button type="button" className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={mi === 0}
                      onClick={() => patchPrayer(pi, { minyanim: move(p.minyanim, mi, -1) })} title="מעלה">▲</button>
                    <button type="button" className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={mi === p.minyanim.length - 1}
                      onClick={() => patchPrayer(pi, { minyanim: move(p.minyanim, mi, 1) })} title="מטה">▼</button>
                    <button type="button" className="text-red-600 hover:underline"
                      onClick={() => patchPrayer(pi, { minyanim: p.minyanim.filter((_, j) => j !== mi) })}>הסר</button>
                  </div>
                </div>
              ))}
              <button type="button" className="text-sm text-brand-600 hover:underline"
                onClick={() => patchPrayer(pi, { minyanim: [...p.minyanim, emptyMinyan()] })}>+ הוספת מניין</button>
            </div>
          </div>
        ))}

        <button type="button" className="btn-secondary"
          onClick={() => setPrayers((ps) => [...ps, emptyPrayer()])}>+ הוספת תפילה</button>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? "שומר..." : "שמירה"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          ביטול
        </button>
      </div>
    </div>
  );
}
