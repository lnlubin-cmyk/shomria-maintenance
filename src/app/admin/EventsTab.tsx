"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import { notExpired } from "@/lib/expiry";
import type { CommunityEvent } from "@/lib/types";
import {
  createEvent,
  updateEventDetails,
  updateEventImage,
  updateEventDoc,
  toggleEventVisibility,
  deleteEvent,
  moveEvent,
} from "./events-actions";

const EVENT_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif";

type EventRow = CommunityEvent & { imageUrl: string | null; docUrl: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = (action: (fd: FormData) => Promise<any>, fd: FormData) => Promise<boolean>;

const fileInputClass =
  "block text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600";

export default function EventsTab({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const run: Run = async (action, fd) => {
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
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        „אירועים” מוצגים בקרוסלה בדף הבית (אחרי „תורה ותפילה”), ומתחלפים אוטומטית. אפשר להוסיף כותרת,
        תאריך, תיאור ותמונה. „תאריך תפוגה” — האירוע לא יוצג לאחר מועד זה (לא חובה).
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{events.length} אירועים</span>
        <button
          className="btn-primary"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
        >
          {adding ? "ביטול" : "הוספת אירוע"}
        </button>
      </div>

      {adding && (
        <form
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createEvent, fd)) setAdding(false);
          }}
        >
          <h2 className="font-semibold">אירוע חדש</h2>
          <div>
            <label className="label" htmlFor="new-title">
              כותרת *
            </label>
            <input id="new-title" name="title" className="field" placeholder="לדוגמה: ערב שירה בציבור" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-date">
                תאריך האירוע (לא חובה)
              </label>
              <input id="new-date" name="event_date" type="date" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="new-exp">
                תאריך תפוגה (לא חובה)
              </label>
              <input id="new-exp" name="expires_at" type="date" className="field" />
            </div>
          </div>
          <div>
            <label className="label">תיאור (לא חובה)</label>
            <RichTextEditor name="body" />
          </div>
          <div>
            <label className="label" htmlFor="new-image">
              תמונה — תצוגה מקדימה בכרטיס (לא חובה)
            </label>
            <input id="new-image" name="image" type="file" accept={EVENT_IMAGE_ACCEPT} className={fileInputClass} />
            <p className="mt-1 text-xs text-gray-500">תמונה (JPG/PNG/WEBP). עד 20MB.</p>
          </div>
          <div>
            <label className="label" htmlFor="new-doc">
              מסמך PDF — לעמוד האירוע המלא (לא חובה)
            </label>
            <input id="new-doc" name="doc" type="file" accept=".pdf,application/pdf" className={fileInputClass} />
            <p className="mt-1 text-xs text-gray-500">אם מצורף PDF, עמוד האירוע יציג אותו במקום התמונה.</p>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "שומר..." : "יצירה"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {events.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין אין אירועים.</div>
        )}

        {events.map((ev, idx) => {
          const expired = !notExpired(ev.expires_at);
          const shown = ev.is_visible && ev.title.trim() !== "" && !expired;
          return (
            <div key={ev.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {shown ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      מוצג
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                      לא מוצג
                    </span>
                  )}
                  {expired && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      פג תוקף
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <form action={async (fd) => { await run(moveEvent, fd); }}>
                    <input type="hidden" name="id" value={ev.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="text-sm text-gray-600 hover:underline disabled:opacity-40" disabled={busy || idx === 0}>
                      ▲
                    </button>
                  </form>
                  <form action={async (fd) => { await run(moveEvent, fd); }}>
                    <input type="hidden" name="id" value={ev.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" className="text-sm text-gray-600 hover:underline disabled:opacity-40" disabled={busy || idx === events.length - 1}>
                      ▼
                    </button>
                  </form>
                  <form action={async (fd) => { await run(toggleEventVisibility, fd); }}>
                    <input type="hidden" name="id" value={ev.id} />
                    <input type="hidden" name="is_visible" value={ev.is_visible ? "false" : "true"} />
                    <button type="submit" className="text-sm text-brand-600 hover:underline" disabled={busy}>
                      {ev.is_visible ? "הסתר" : "הצג"}
                    </button>
                  </form>
                  <form
                    action={async (fd) => { await run(deleteEvent, fd); }}
                    onSubmit={(e) => {
                      if (!confirm(`למחוק את האירוע „${ev.title}”?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={ev.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline" disabled={busy}>
                      מחיקה
                    </button>
                  </form>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {/* Image preview + edit */}
                <form
                  className="w-40 shrink-0 space-y-2"
                  action={async (fd) => { await run(updateEventImage, fd); }}
                >
                  <input type="hidden" name="id" value={ev.id} />
                  <div className="relative h-24 w-40 overflow-hidden rounded-lg bg-gray-100">
                    {ev.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs text-gray-400">אין תמונה</span>
                    )}
                  </div>
                  <input name="image" type="file" accept={EVENT_IMAGE_ACCEPT} className={fileInputClass} />
                  <div className="flex items-center justify-between">
                    {ev.imageUrl ? (
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input type="checkbox" name="remove_image" value="1" /> הסר
                      </label>
                    ) : (
                      <span />
                    )}
                    <button type="submit" className="text-sm text-brand-600 hover:underline" disabled={busy}>
                      שמור תמונה
                    </button>
                  </div>
                </form>

                {/* Details */}
                <form className="flex-1 space-y-2" action={async (fd) => { await run(updateEventDetails, fd); }}>
                  <input type="hidden" name="id" value={ev.id} />
                  <input name="title" className="field" defaultValue={ev.title} required />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="text-xs text-gray-500">
                      תאריך האירוע
                      <input name="event_date" type="date" className="field" defaultValue={ev.event_date ?? ""} />
                    </label>
                    <label className="text-xs text-gray-500">
                      תאריך תפוגה
                      <input name="expires_at" type="date" className="field" defaultValue={ev.expires_at ?? ""} />
                    </label>
                  </div>
                  <RichTextEditor name="body" defaultValue={ev.body} />
                  <button type="submit" className="btn-secondary" disabled={busy}>
                    שמור פרטים
                  </button>
                </form>
              </div>

              {/* Optional PDF shown on the event's full page (instead of the image) */}
              <form
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm"
                action={async (fd) => { await run(updateEventDoc, fd); }}
              >
                <input type="hidden" name="id" value={ev.id} />
                <span className="text-gray-600">מסמך PDF (עמוד מלא):</span>
                {ev.docUrl ? (
                  <>
                    <a href={ev.docUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                      צפייה
                    </a>
                    <label className="flex items-center gap-1 text-xs text-gray-600">
                      <input type="checkbox" name="remove_doc" value="1" /> הסר
                    </label>
                  </>
                ) : (
                  <span className="text-gray-400">אין</span>
                )}
                <input name="doc" type="file" accept=".pdf,application/pdf" className={fileInputClass} />
                <button type="submit" className="btn-secondary" disabled={busy}>
                  שמור מסמך
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
