"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PrayerSchedule } from "@/lib/prayer-times";
import { toggleScheduleVisible, deleteSchedule, moveSchedule } from "./prayer-actions";
import ScheduleEditor from "./ScheduleEditor";

export default function PrayerTimesTab({ schedules }: { schedules: PrayerSchedule[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<PrayerSchedule | null>(null);
  const [adding, setAdding] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(p: Promise<any>) {
    setError(null);
    setBusy(true);
    const result = await p;
    setBusy(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (adding || editing) {
    return (
      <ScheduleEditor
        schedule={editing}
        onDone={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        כל לוח (למשל „יום חול”, „שבת”) מכיל תפילות, ולכל תפילה מניינים. ניתן להסתיר לוח שלם או מניין
        בודד. הלוחות המוצגים יופיעו ב„זמני תפילות” לפי הסדר.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{schedules.length} לוחות</span>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          הוספת לוח
        </button>
      </div>

      <div className="space-y-2">
        {schedules.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין אין לוחות תפילה.</div>
        )}
        {schedules.map((s, i) => {
          const minyanCount = s.prayers.reduce((n, p) => n + p.minyanim.length, 0);
          return (
            <div key={s.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{s.title || "(ללא כותרת)"}</span>
                  {s.is_visible ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      מוצג
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      מוסתר
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {s.prayers.length} תפילות · {minyanCount} מניינים
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex flex-col">
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === 0}
                    onClick={() => run(moveSchedule(s.id, "up"))} title="מעלה">▲</button>
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === schedules.length - 1}
                    onClick={() => run(moveSchedule(s.id, "down"))} title="מטה">▼</button>
                </div>
                <button className="text-brand-600 hover:underline" disabled={busy}
                  onClick={() => run(toggleScheduleVisible(s.id, !s.is_visible))}>
                  {s.is_visible ? "הסתר" : "הצג"}
                </button>
                <button className="text-brand-600 hover:underline" onClick={() => setEditing(s)}>
                  עריכה
                </button>
                <button className="text-red-600 hover:underline" disabled={busy}
                  onClick={() => {
                    if (confirm(`למחוק את הלוח „${s.title}”?`)) run(deleteSchedule(s.id));
                  }}>
                  מחיקה
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
