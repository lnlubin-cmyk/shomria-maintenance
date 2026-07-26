"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HomeMedia } from "@/lib/types";
import {
  createSignedUpload,
  createHomeMedia,
  createYoutubeMedia,
  setHomeMediaActive,
  deleteHomeMedia,
  moveHomeMedia,
} from "./home-media-actions";

const BUCKET = "home-media";
const MAX_BYTES = 50 * 1024 * 1024;

const KIND_LABEL: Record<string, string> = { image: "תמונה", video: "וידאו", youtube: "YouTube" };

export default function HomeMediaTab({ items }: { items: (HomeMedia & { previewUrl: string })[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState("");

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("יש להעלות קובץ תמונה או וידאו בלבד");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("הקובץ גדול מ-50MB. כדאי לדחוס וידאו לפני העלאה.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // 1. get a signed upload URL (server, admin-gated)
      const signed = await createSignedUpload(file.name, file.type);
      if ("error" in signed) {
        setError(signed.error);
        return;
      }
      // 2. upload the bytes straight to Storage (bypasses the serverless limit)
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) {
        setError("העלאת הקובץ נכשלה");
        return;
      }
      // 3. record it
      const res = await createHomeMedia(signed.path, file.name, file.type);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const activeCount = items.filter((m) => m.is_active).length;

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        המדיה הפעילה מתנגנת בדף הבית בזה אחר זה, לפי הסדר. ניתן להעלות תמונות וסרטונים, לסמן כל פריט
        כפעיל או מושבת, ולשנות את הסדר. {activeCount} פריטים פעילים.
      </div>

      <div className="card">
        <h2 className="font-semibold">העלאת מדיה</h2>
        <p className="mt-1 text-sm text-gray-600">תמונה או וידאו, עד 50MB. הפריט נוסף כפעיל.</p>
        <div className="mt-3 flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFile}
            disabled={busy}
            className="block w-full text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
          />
          {busy && <span className="whitespace-nowrap text-sm text-gray-600">מעלה...</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">הוספת סרטון YouTube</h2>
        <p className="mt-1 text-sm text-gray-600">
          לסרטונים ארוכים או כבדים — הדבק קישור לסרטון מהערוץ שלנו (ללא הגבלת גודל). ודא שהסרטון
          מוגדר „ציבורי” או „לא רשום” ושהטמעה מותרת.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="url"
            dir="ltr"
            placeholder="https://www.youtube.com/watch?v=..."
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            className="field flex-1"
          />
          <button
            className="btn-secondary"
            disabled={busy || !ytUrl.trim()}
            onClick={async () => {
              if (await run(createYoutubeMedia(ytUrl))) setYtUrl("");
            }}
          >
            הוספה
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין לא הועלתה מדיה.</div>
        )}

        {items.map((m, i) => (
          <div key={m.id} className="card flex flex-wrap items-center gap-4">
            <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {m.kind === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={m.previewUrl} className="h-full w-full object-cover" muted preload="metadata" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.previewUrl} alt={m.file_name ?? ""} className="h-full w-full object-cover" />
              )}
              {m.kind === "youtube" && (
                <span className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">
                  ▶
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                {m.is_active ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    פעיל
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    מושבת
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-gray-700" dir="ltr">
                {m.kind === "youtube" ? `YouTube · ${m.youtube_id}` : (m.file_name ?? "מדיה")}
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex flex-col">
                <button
                  className="text-gray-500 hover:text-brand-600 disabled:opacity-30"
                  disabled={busy || i === 0}
                  onClick={() => run(moveHomeMedia(m.id, "up"))}
                  title="הזז מעלה"
                >
                  ▲
                </button>
                <button
                  className="text-gray-500 hover:text-brand-600 disabled:opacity-30"
                  disabled={busy || i === items.length - 1}
                  onClick={() => run(moveHomeMedia(m.id, "down"))}
                  title="הזז מטה"
                >
                  ▼
                </button>
              </div>
              <button
                className="text-brand-600 hover:underline"
                disabled={busy}
                onClick={() => run(setHomeMediaActive(m.id, !m.is_active))}
              >
                {m.is_active ? "השבת" : "הפעל"}
              </button>
              <button
                className="text-red-600 hover:underline"
                disabled={busy}
                onClick={() => {
                  if (confirm("למחוק את פריט המדיה?")) run(deleteHomeMedia(m.id));
                }}
              >
                מחיקה
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
