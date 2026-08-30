"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveMoment, providerLabel } from "@/lib/moments-embed";
import type { Moment } from "@/lib/types";
import {
  createMoment,
  updateMomentDetails,
  updateMomentLink,
  toggleMomentVisibility,
  deleteMoment,
  moveMoment,
} from "./moments-actions";

export default function MomentsTab({ moments }: { moments: Moment[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(action: (fd: FormData) => Promise<any>, fd: FormData): Promise<boolean> {
    setError(null);
    setBusy(true);
    const result = await action(fd);
    setBusy(false);
    if (result && "error" in result) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        „רגעים שזוכרים” — אירועים היסטוריים מחיי הקהילה, מוצגים תחת מדור „קהילה”. אפשר להדביק קישור
        ל-YouTube, לקובץ ב-Google Drive, לסרטון Bunny, או כתובת אתר אחרת. סרטוני YouTube / Drive /
        Bunny מוטמעים בעמוד; קישור אחר נפתח בלשונית חדשה.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{moments.length} רגעים</span>
        <button
          className="btn-primary"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
        >
          {adding ? "ביטול" : "הוספת רגע"}
        </button>
      </div>

      {adding && (
        <form
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createMoment, fd)) setAdding(false);
          }}
        >
          <h2 className="font-semibold">רגע חדש</h2>
          <div>
            <label className="label" htmlFor="new-title">
              כותרת *
            </label>
            <input id="new-title" name="title" className="field" placeholder="לדוגמה: חגיגות היובל" required />
          </div>
          <div>
            <label className="label" htmlFor="new-url">
              קישור *
            </label>
            <input
              id="new-url"
              name="url"
              className="field"
              placeholder="קישור YouTube / Google Drive / Bunny / כתובת אתר"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-date">
                תאריך האירוע (לא חובה)
              </label>
              <input id="new-date" name="event_date" type="date" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="new-expires">
                תאריך תפוגה (לא חובה)
              </label>
              <input id="new-expires" name="expires_at" type="date" className="field" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="new-desc">
              תיאור (לא חובה)
            </label>
            <textarea id="new-desc" name="description" className="field" rows={2} />
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "שומר..." : "יצירה"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {moments.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין אין רגעים.</div>
        )}

        {moments.map((m, idx) => {
          const view = resolveMoment(m);
          return (
            <div key={m.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {m.is_visible ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      מוצג
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      מוסתר
                    </span>
                  )}
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                    {providerLabel(m.provider)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Reorder */}
                  <form action={async (fd) => { await run(moveMoment, fd); }}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="text-sm text-gray-600 hover:underline disabled:opacity-40" disabled={busy || idx === 0}>
                      ▲
                    </button>
                  </form>
                  <form action={async (fd) => { await run(moveMoment, fd); }}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" className="text-sm text-gray-600 hover:underline disabled:opacity-40" disabled={busy || idx === moments.length - 1}>
                      ▼
                    </button>
                  </form>

                  {/* Visibility */}
                  <form action={async (fd) => { await run(toggleMomentVisibility, fd); }}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="is_visible" value={m.is_visible ? "false" : "true"} />
                    <button type="submit" className="text-sm text-brand-600 hover:underline" disabled={busy}>
                      {m.is_visible ? "הסתר" : "הצג"}
                    </button>
                  </form>

                  {/* Delete */}
                  <form
                    action={async (fd) => { await run(deleteMoment, fd); }}
                    onSubmit={(e) => {
                      if (!confirm(`למחוק את הרגע „${m.title}”?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={m.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline" disabled={busy}>
                      מחיקה
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex gap-3">
                {/* Thumbnail preview */}
                <a
                  href={view.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-800"
                >
                  {view.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={view.thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-gray-300">
                      קישור
                    </span>
                  )}
                </a>

                {/* Edit title / date / description */}
                <form className="flex-1 space-y-2" action={async (fd) => { await run(updateMomentDetails, fd); }}>
                  <input type="hidden" name="id" value={m.id} />
                  <input name="title" className="field" defaultValue={m.title} required />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-gray-500">
                      תאריך
                      <input name="event_date" type="date" className="field max-w-[9rem]" defaultValue={m.event_date ?? ""} />
                    </label>
                    <label className="text-xs text-gray-500">
                      תפוגה
                      <input name="expires_at" type="date" className="field max-w-[9rem]" defaultValue={m.expires_at ?? ""} />
                    </label>
                    <button type="submit" className="btn-secondary self-end" disabled={busy}>
                      שמור פרטים
                    </button>
                  </div>
                  <textarea name="description" className="field" rows={2} defaultValue={m.description} placeholder="תיאור (לא חובה)" />
                </form>
              </div>

              {/* Change link */}
              <form className="flex flex-wrap items-center gap-2" action={async (fd) => { await run(updateMomentLink, fd); }}>
                <input type="hidden" name="id" value={m.id} />
                <input name="url" className="field flex-1" placeholder="החלפת הקישור (YouTube / Drive / Bunny / כתובת)" required />
                <button type="submit" className="btn-secondary" disabled={busy}>
                  עדכון קישור
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
