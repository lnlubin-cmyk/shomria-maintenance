"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CommunityItem, DocMode } from "@/lib/types";
import { DOC_ACCEPT } from "@/lib/doc-files";
import RichTextEditor from "@/components/RichTextEditor";
import {
  createCommunityItem,
  updateCommunityDetails,
  updateCommunitySection,
  updateCommunityContent,
  toggleCommunityVisibility,
  deleteCommunityItem,
} from "./community-actions";

const SECTION_LABELS = { community: "קהילה", info: "מידע לתושב", torah: "תורה ותפילה" } as const;

const ICON_SUGGESTIONS = ["📄", "📅", "📰", "🎉", "🏠", "📢", "🕯️", "🌳", "⚽", "🎵", "🍞", "📚"];

/** Emoji field with clickable suggestions (so a non-technical admin needn't type one). */
function EmojiField({ defaultValue = "" }: { defaultValue?: string }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        name="icon"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        maxLength={8}
        className="field w-16 text-center text-xl"
        placeholder="📄"
        aria-label="אייקון"
      />
      <div className="flex flex-wrap gap-1">
        {ICON_SUGGESTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setVal(e)}
            className="rounded p-1 text-xl leading-none hover:bg-gray-100"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = (action: (fd: FormData) => Promise<any>, fd: FormData) => Promise<boolean>;

const fileInputClass =
  "block text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600";

/** File / free-text mode picker (shared by the add form and each item). */
function ModePicker({ mode, onChange }: { mode: DocMode; onChange: (m: DocMode) => void }) {
  return (
    <div>
      <span className="label">מצב תצוגה</span>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" value="file" checked={mode === "file"} onChange={() => onChange("file")} />
          קובץ (PDF או תמונה)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" value="text" checked={mode === "text"} onChange={() => onChange("text")} />
          טקסט חופשי
        </label>
      </div>
    </div>
  );
}

export default function CommunityTab({ items }: { items: CommunityItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<DocMode>("file");

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
        פריט מופיע בתפריט (במדור „קהילה”, „מידע לתושב” או „תורה ותפילה” לפי הבחירה) רק כאשר יש לו נושא,
        תוכן — קובץ (PDF או תמונה) או טקסט חופשי — והוא מוגדר „מוצג”.
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
            if (await run(createCommunityItem, fd)) {
              setAdding(false);
              setAddMode("file");
            }
          }}
        >
          <h2 className="font-semibold">פריט חדש</h2>
          <div>
            <label className="label" htmlFor="new-subject">
              נושא (הטקסט שיוצג בתפריט) *
            </label>
            <input id="new-subject" name="subject" className="field" placeholder="לדוגמה: הידיעון האחרון" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">אייקון (מוצג בכרטיס בדף הבית)</label>
              <EmojiField />
            </div>
            <div>
              <label className="label" htmlFor="new-desc">
                תיאור קצר (לא חובה)
              </label>
              <input id="new-desc" name="description" className="field" placeholder="מוצג מתחת לכותרת בכרטיס" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="new-expires">
              תאריך תפוגה (לא חובה)
            </label>
            <input id="new-expires" name="expires_at" type="date" className="field max-w-xs" />
            <p className="mt-1 text-xs text-gray-500">הפריט לא יוצג לאחר תאריך זה.</p>
          </div>
          <div>
            <label className="label" htmlFor="new-section">
              מדור בתפריט *
            </label>
            <select id="new-section" name="section" className="field" defaultValue="community">
              <option value="community">קהילה</option>
              <option value="info">מידע לתושב</option>
              <option value="torah">תורה ותפילה</option>
            </select>
          </div>

          <ModePicker mode={addMode} onChange={setAddMode} />

          {/* Free text */}
          <div className={addMode === "text" ? "" : "opacity-50"}>
            <label className="label">
              טקסט חופשי {addMode === "text" && <span className="text-red-600">*</span>}
            </label>
            <RichTextEditor name="body" />
            <p className="mt-1 text-xs text-gray-500">אפשר להדגיש טקסט (מודגש / נטוי / קו תחתון). כל שורה תוצג כשורה נפרדת.</p>
          </div>

          {/* File */}
          <div className={addMode === "file" ? "" : "opacity-50"}>
            <label className="label" htmlFor="new-file">
              קובץ (PDF או תמונה)
            </label>
            <input id="new-file" name="file" type="file" accept={DOC_ACCEPT} className={fileInputClass} />
            <p className="mt-1 text-xs text-gray-500">PDF או תמונה (JPG/PNG/WEBP). אפשר להוסיף עכשיו או מאוחר יותר. עד 20MB.</p>
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

        {items.map((item) => (
          <ItemCard key={item.id} item={item} run={run} busy={busy} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, run, busy }: { item: CommunityItem; run: Run; busy: boolean }) {
  const [mode, setMode] = useState<DocMode>(item.mode);
  const hasFile = !!item.file_path;
  const hasContent = item.mode === "text" ? item.body.trim() !== "" : hasFile;
  const shown = item.is_visible && hasContent && item.subject.trim() !== "";

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {shown ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            מוצג בתפריט
          </span>
        ) : (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
            לא מוצג בתפריט
            {item.is_visible && !hasContent ? " — חסר תוכן" : ""}
          </span>
        )}

        <div className="flex items-center gap-3">
          <form action={async (fd) => { await run(toggleCommunityVisibility, fd); }}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="is_visible" value={item.is_visible ? "false" : "true"} />
            <button type="submit" className="text-sm text-brand-600 hover:underline" disabled={busy}>
              {item.is_visible ? "הסתר" : "הצג"}
            </button>
          </form>

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

      {/* Tile details: subject, icon, description */}
      <form className="space-y-2" action={async (fd) => { await run(updateCommunityDetails, fd); }}>
        <input type="hidden" name="id" value={item.id} />
        <div>
          <label className="label">נושא</label>
          <input name="subject" className="field" defaultValue={item.subject} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">אייקון</label>
            <EmojiField defaultValue={item.icon} />
          </div>
          <div>
            <label className="label">תיאור קצר (לא חובה)</label>
            <input name="description" className="field" defaultValue={item.description} placeholder="מוצג מתחת לכותרת בכרטיס" />
          </div>
          <div>
            <label className="label">תאריך תפוגה (לא חובה)</label>
            <input name="expires_at" type="date" className="field" defaultValue={item.expires_at ?? ""} />
          </div>
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>
          שמור פרטים
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
          <option value="torah">{SECTION_LABELS.torah}</option>
        </select>
      </form>

      {/* Content — mode + rich text + file, saved together */}
      <form
        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
        action={async (fd) => { await run(updateCommunityContent, fd); }}
      >
        <input type="hidden" name="id" value={item.id} />

        <ModePicker mode={mode} onChange={setMode} />

        {/* Free text */}
        <div className={mode === "text" ? "" : "opacity-50"}>
          <label className="label">טקסט חופשי</label>
          <RichTextEditor name="body" defaultValue={item.body} />
          <p className="mt-1 text-xs text-gray-500">מודגש / נטוי / קו תחתון. כל שורה תוצג כשורה נפרדת.</p>
        </div>

        {/* File */}
        <div className={mode === "file" ? "" : "opacity-50"}>
          <label className="label">קובץ (PDF או תמונה)</label>
          {hasFile ? (
            <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium text-gray-700">קובץ נוכחי: {item.file_name ?? "קובץ"}</span>
              <Link href={`/community/${item.id}`} target="_blank" className="text-brand-600 hover:underline">
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
          <input name="file" type="file" accept={DOC_ACCEPT} className={fileInputClass} />
          <p className="mt-1 text-xs text-gray-500">העלאת קובץ חדש תחליף את הקיים. עד 20MB.</p>
        </div>

        <button type="submit" className="btn-secondary" disabled={busy}>
          שמירת תוכן
        </button>
      </form>
    </div>
  );
}
