"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TorahLesson } from "@/lib/types";
import {
  createLesson,
  updateLesson,
  toggleLessonVisible,
  deleteLesson,
  moveLesson,
} from "./torah-actions";

export default function TorahLessonsTab({ lessons }: { lessons: TorahLesson[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(p: Promise<any>): Promise<boolean> {
    setError(null);
    setBusy(true);
    const result = await p;
    setBusy(false);
    if (result && "error" in result) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  const fields = (l?: TorahLesson) => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">נושא *</label>
          <input name="subject" className="field" defaultValue={l?.subject} required />
        </div>
        <div>
          <label className="label">מעביר השיעור</label>
          <input name="lecturer" className="field" placeholder="שם מעביר השיעור" defaultValue={l?.lecturer} />
        </div>
        <div>
          <label className="label">מועד</label>
          <input name="occurrence" className="field" placeholder="לדוגמה: כל יום ראשון ושלישי" defaultValue={l?.occurrence} />
        </div>
        <div>
          <label className="label">שעה</label>
          <input name="hour" className="field" placeholder="לדוגמה: 20:30" defaultValue={l?.hour} />
        </div>
      </div>
      <div>
        <label className="label">הערות</label>
        <textarea name="notes" className="field" rows={2} defaultValue={l?.notes} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{lessons.length} שיעורים</span>
        <button className="btn-primary" onClick={() => { setAdding((v) => !v); setEditingId(null); }}>
          {adding ? "ביטול" : "הוספת שיעור"}
        </button>
      </div>

      {adding && (
        <form
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createLesson(fd))) setAdding(false);
          }}
        >
          <h2 className="font-semibold">שיעור חדש</h2>
          {fields()}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "שומר..." : "יצירה"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {lessons.length === 0 && !adding && (
          <div className="card text-center text-sm text-gray-500">עדיין אין שיעורים.</div>
        )}

        {lessons.map((l, i) =>
          editingId === l.id ? (
            <form
              key={l.id}
              className="card space-y-4"
              action={async (fd) => {
                if (await run(updateLesson(fd))) setEditingId(null);
              }}
            >
              <input type="hidden" name="id" value={l.id} />
              <h2 className="font-semibold">עריכת שיעור</h2>
              {fields(l)}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={busy}>שמירה</button>
                <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>ביטול</button>
              </div>
            </form>
          ) : (
            <div key={l.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{l.subject}</span>
                  {!l.is_visible && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">מוסתר</span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {[l.lecturer, l.occurrence, l.hour].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex flex-col">
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === 0}
                    onClick={() => run(moveLesson(l.id, "up"))} title="מעלה">▲</button>
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === lessons.length - 1}
                    onClick={() => run(moveLesson(l.id, "down"))} title="מטה">▼</button>
                </div>
                <button className="text-brand-600 hover:underline" disabled={busy}
                  onClick={() => run(toggleLessonVisible(l.id, !l.is_visible))}>
                  {l.is_visible ? "הסתר" : "הצג"}
                </button>
                <button className="text-brand-600 hover:underline" onClick={() => { setEditingId(l.id); setAdding(false); }}>
                  עריכה
                </button>
                <button className="text-red-600 hover:underline" disabled={busy}
                  onClick={() => { if (confirm(`למחוק את השיעור „${l.subject}”?`)) run(deleteLesson(l.id)); }}>
                  מחיקה
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
