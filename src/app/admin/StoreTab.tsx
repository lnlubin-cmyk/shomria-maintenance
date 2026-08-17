"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StoreInfo } from "@/lib/types";
import { DOC_ACCEPT } from "@/lib/doc-files";
import RichTextEditor from "@/components/RichTextEditor";
import { updateStore } from "./store-actions";

export default function StoreTab({ info }: { info: StoreInfo }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"text" | "pdf">(info.mode);

  async function onSave(fd: FormData) {
    setError(null);
    setOk(false);
    setBusy(true);
    const res = await updateStore(fd);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form action={onSave} className="max-w-2xl space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {ok && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">ההגדרות נשמרו.</div>}

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        מידע על המכולת שיוצג לתושבים תחת „מידע לתושב”. אפשר להציג טקסט חופשי (למשל שעות פתיחה) או קובץ
        (PDF או תמונה) — בחר את מצב התצוגה. שני התכנים נשמרים, כך שאפשר לעבור ביניהם בכל עת.
      </div>

      <div>
        <label className="label" htmlFor="menu_label">
          שם הפריט בתפריט
        </label>
        <input
          id="menu_label"
          name="menu_label"
          className="field max-w-sm"
          defaultValue={info.menu_label}
          placeholder="מכולת"
        />
      </div>

      <div>
        <span className="label">מצב תצוגה</span>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              value="text"
              checked={mode === "text"}
              onChange={() => setMode("text")}
            />
            טקסט חופשי
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              value="pdf"
              checked={mode === "pdf"}
              onChange={() => setMode("pdf")}
            />
            קובץ (PDF או תמונה)
          </label>
        </div>
      </div>

      {/* Free text */}
      <div className={mode === "text" ? "" : "opacity-50"}>
        <label className="label">
          טקסט חופשי {mode === "text" && <span className="text-red-600">*</span>}
        </label>
        <RichTextEditor name="body" defaultValue={info.body} />
        <p className="mt-1 text-xs text-gray-500">
          אפשר להדגיש טקסט (מודגש / נטוי / קו תחתון). כל שורה תוצג כשורה נפרדת. לדוגמה: „זמני פתיחה — ימים א׳-ה׳ 7:00-19:00”.
        </p>
      </div>

      {/* PDF */}
      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${mode === "pdf" ? "" : "opacity-50"}`}>
        <label className="label">קובץ (PDF או תמונה)</label>
        {info.file_path ? (
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-700">קובץ נוכחי: {info.file_name ?? "PDF"}</span>
            <Link href="/grocery" target="_blank" className="text-brand-600 hover:underline">
              צפייה
            </Link>
            <label className="flex items-center gap-2 text-gray-600">
              <input type="checkbox" name="remove_file" value="1" />
              הסר את הקובץ
            </label>
          </div>
        ) : (
          <p className="mb-2 text-sm text-gray-500">אין קובץ מצורף.</p>
        )}
        <input
          name="file"
          type="file"
          accept={DOC_ACCEPT}
          className="block text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
        />
        <p className="mt-1 text-xs text-gray-500">PDF או תמונה (JPG/PNG/WEBP). העלאת קובץ חדש תחליף את הקיים. עד 20MB.</p>
      </div>

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "שומר..." : "שמירה"}
      </button>
    </form>
  );
}
