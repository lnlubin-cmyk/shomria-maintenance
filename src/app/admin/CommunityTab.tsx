"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CommunityItem } from "@/lib/types";
import {
  createCommunityItem,
  updateCommunitySubject,
  updateCommunitySection,
  replaceCommunityFile,
  removeCommunityFile,
  toggleCommunityVisibility,
  deleteCommunityItem,
} from "./community-actions";

const SECTION_LABELS = { community: "קהילה", info: "מידע לתושב" } as const;

export default function CommunityTab({ items }: { items: CommunityItem[] }) {
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
        פריט מופיע בתפריט (במדור „קהילה” או „מידע לתושב” לפי הבחירה) רק כאשר יש לו נושא, קובץ PDF,
        והוא מוגדר „מוצג”.
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{items.length} פריטים</span>
        <button
          className="btn-primary"
          onClick={() => {
            setAdding((v) => !v);
            setError(null);
          }}
        >
          {adding ? "ביטול" : "הוספת פריט"}
        </button>
      </div>

      {adding && (
        <form
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createCommunityItem, fd)) setAdding(false);
          }}
        >
          <h2 className="font-semibold">פריט חדש</h2>
          <div>
            <label className="label" htmlFor="new-subject">
              נושא (הטקסט שיוצג בתפריט) *
            </label>
            <input id="new-subject" name="subject" className="field" placeholder="לדוגמה: הידיעון האחרון" required />
          </div>
          <div>
            <label className="label" htmlFor="new-section">
              מדור בתפריט *
            </label>
            <select id="new-section" name="section" className="field" defaultValue="community">
              <option value="community">קהילה</option>
              <option value="info">מידע לתושב</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="new-file">
              קובץ PDF
            </label>
            <input
              id="new-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="block w-full text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
            />
            <p className="mt-1 text-xs text-gray-500">אפשר להוסיף קובץ עכשיו או מאוחר יותר. עד 20MB.</p>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "שומר..." : "יצירה"}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {items.length === 0 && (
          <div className="card text-center text-sm text-gray-500">עדיין אין פריטים.</div>
        )}

        {items.map((item) => {
          const hasFile = !!item.file_path;
          const shown = item.is_visible && hasFile && item.subject.trim() !== "";
          return (
            <div key={item.id} className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {shown ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    מוצג בתפריט
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                    לא מוצג בתפריט
                    {item.is_visible && !hasFile ? " — חסר קובץ" : ""}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  {/* Visibility toggle */}
                  <form action={async (fd) => { await run(toggleCommunityVisibility, fd); }}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="is_visible" value={item.is_visible ? "false" : "true"} />
                    <button type="submit" className="text-sm text-brand-600 hover:underline" disabled={busy}>
                      {item.is_visible ? "הסתר" : "הצג"}
                    </button>
                  </form>

                  {/* Delete */}
                  <form
                    action={async (fd) => { await run(deleteCommunityItem, fd); }}
                    onSubmit={(e) => {
                      if (!confirm(`למחוק את הפריט „${item.subject}”?`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline" disabled={busy}>
                      מחיקה
                    </button>
                  </form>
                </div>
              </div>

              {/* Subject (editable) */}
              <form className="flex items-end gap-2" action={async (fd) => { await run(updateCommunitySubject, fd); }}>
                <input type="hidden" name="id" value={item.id} />
                <div className="flex-1">
                  <label className="label">נושא</label>
                  <input name="subject" className="field" defaultValue={item.subject} required />
                </div>
                <button type="submit" className="btn-secondary" disabled={busy}>
                  שמור נושא
                </button>
              </form>

              {/* Section (changes which menu it appears under) */}
              <form action={async (fd) => { await run(updateCommunitySection, fd); }}>
                <input type="hidden" name="id" value={item.id} />
                <label className="label">מדור בתפריט</label>
                <select
                  name="section"
                  className="field max-w-xs"
                  defaultValue={item.section}
                  disabled={busy}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                >
                  <option value="community">{SECTION_LABELS.community}</option>
                  <option value="info">{SECTION_LABELS.info}</option>
                </select>
              </form>

              {/* File */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                  {hasFile ? (
                    <>
                      <span className="font-medium text-gray-700">קובץ: {item.file_name ?? "PDF"}</span>
                      <Link href={`/community/${item.id}`} target="_blank" className="text-brand-600 hover:underline">
                        צפייה
                      </Link>
                      <form action={async (fd) => { await run(removeCommunityFile, fd); }}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="text-red-600 hover:underline" disabled={busy}>
                          הסרת קובץ
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="text-gray-500">אין קובץ מצורף.</span>
                  )}
                </div>

                <form className="flex flex-wrap items-center gap-2" action={async (fd) => { await run(replaceCommunityFile, fd); }}>
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    name="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                    className="block text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
                  />
                  <button type="submit" className="btn-secondary" disabled={busy}>
                    {hasFile ? "החלפת קובץ" : "העלאת קובץ"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
