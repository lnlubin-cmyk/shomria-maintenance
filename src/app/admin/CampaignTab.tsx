"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Campaign } from "@/lib/types";
import {
  createCampaignUpload,
  createCampaign,
  updateCampaign,
  setCampaignActive,
  deleteCampaign,
} from "./campaign-actions";

const CAMPAIGN_BUCKET = "campaigns";
const MAX_BYTES = 5 * 1024 * 1024;

export default function CampaignTab({ items }: { items: (Campaign & { previewUrl: string })[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(p: Promise<any>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      const res = await p;
      if (res && "error" in res) {
        setError(res.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("שגיאת רשת. נסה שוב.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("יש לבחור תמונה לקמפיין");
    if (!file.type.startsWith("image/")) return setError("יש להעלות קובץ תמונה בלבד");
    if (file.size > MAX_BYTES) return setError("התמונה גדולה מ-5MB");

    setError(null);
    setBusy(true);
    try {
      const signed = await createCampaignUpload(file.name, file.type);
      if ("error" in signed) return setError(signed.error);
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(CAMPAIGN_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) return setError("העלאת התמונה נכשלה");
      const res = await createCampaign(signed.path, file.name, title, link);
      if ("error" in res) return setError(res.error);
      setAdding(false);
      setTitle("");
      setLink("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  const activeId = items.find((c) => c.is_active)?.id;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        הקמפיין הפעיל מוצג בכניסה הראשונה לאתר (פעם אחת לכל מכשיר). קמפיין אחד יכול להיות פעיל בכל רגע.
        קישור אופציונלי מוצג כ„לפרטים הקש כאן” — קישור פנימי (מתחיל ב-/) נפתח למשתמשים רשומים בלבד.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{items.length} קמפיינים</span>
        <button className="btn-primary" onClick={() => { setAdding((v) => !v); setError(null); }}>
          {adding ? "ביטול" : "הוספת קמפיין"}
        </button>
      </div>

      {adding && (
        <div className="card space-y-4">
          <h2 className="font-semibold">קמפיין חדש</h2>
          <div>
            <label className="label">כותרת (לשימוש פנימי)</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: רישום לחוגים" />
          </div>
          <div>
            <label className="label">קישור לפרטים (אופציונלי)</label>
            <input className="field" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/votes/…  או  https://example.com" />
            <p className="mt-1 text-xs text-gray-500">קישור פנימי מתחיל ב-/ (נפתח למשתמשים רשומים). קישור חיצוני — כתובת מלאה.</p>
          </div>
          <div>
            <label className="label">תמונת הקמפיין *</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="block w-full text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
            />
            <p className="mt-1 text-xs text-gray-500">JPG/PNG, עד 5MB. מומלץ פוסטר בעמוד אחד.</p>
          </div>
          <button className="btn-primary" disabled={busy} onClick={handleAdd}>
            {busy ? "מעלה…" : "יצירה"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין אין קמפיינים.</div>
        )}

        {items.map((c) => (
          <div key={c.id} className="card space-y-3">
            <div className="flex flex-wrap items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.previewUrl} alt={c.title} className="h-28 w-40 shrink-0 rounded-lg border border-gray-200 object-cover" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {c.is_active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">פעיל</span>
                  ) : (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">מושבת</span>
                  )}
                  {activeId && activeId !== c.id && c.is_active === false && (
                    <span className="text-xs text-gray-400">(קמפיין אחר פעיל)</span>
                  )}
                </div>

                <form className="grid gap-2 sm:grid-cols-2" action={async (fd) => { await run(updateCampaign(fd)); }}>
                  <input type="hidden" name="id" value={c.id} />
                  <div>
                    <label className="label">כותרת</label>
                    <input name="title" className="field" defaultValue={c.title} />
                  </div>
                  <div>
                    <label className="label">קישור</label>
                    <input name="link_url" className="field" dir="ltr" defaultValue={c.link_url ?? ""} placeholder="/…  או  https://…" />
                  </div>
                  <div className="sm:col-span-2">
                    <button className="btn-secondary" disabled={busy}>שמירת פרטים</button>
                  </div>
                </form>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <button
                    className="text-brand-600 hover:underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() => run(setCampaignActive(c.id, !c.is_active))}
                  >
                    {c.is_active ? "השבתה" : "הפעלה"}
                  </button>
                  <button
                    className="text-red-600 hover:underline disabled:opacity-50"
                    disabled={busy}
                    onClick={() => { if (confirm("למחוק את הקמפיין?")) run(deleteCampaign(c.id)); }}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
