"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Contact } from "@/lib/types";
import RichTextEditor from "@/components/RichTextEditor";
import {
  createContact,
  updateContact,
  toggleContactVisible,
  deleteContact,
  moveContact,
} from "./contact-actions";

export default function ContactsTab({ contacts }: { contacts: Contact[] }) {
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

  const fields = (c?: Contact) => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">שם היחידה *</label>
          <input name="name" className="field" placeholder="לדוגמה: משרד" defaultValue={c?.name} required />
        </div>
        <div>
          <label className="label">דוא״ל</label>
          <input name="email" type="email" className="field" placeholder="אופציונלי" defaultValue={c?.email} dir="ltr" />
        </div>
        <div>
          <label className="label">טלפון</label>
          <input name="phone" className="field" placeholder="אופציונלי" defaultValue={c?.phone} dir="ltr" />
        </div>
      </div>
      <div>
        <label className="label">מידע נוסף (אופציונלי)</label>
        <RichTextEditor name="notes" defaultValue={c?.notes ?? ""} />
        <p className="mt-1 text-xs text-gray-500">אפשר להדגיש טקסט. לדוגמה: „שעות פעילות: א׳–ה׳ 8:00–13:00”.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{contacts.length} אנשי קשר</span>
        <button className="btn-primary" onClick={() => { setAdding((v) => !v); setEditingId(null); }}>
          {adding ? "ביטול" : "הוספת איש קשר"}
        </button>
      </div>

      {adding && (
        <form
          className="card space-y-4"
          action={async (fd) => {
            if (await run(createContact(fd))) setAdding(false);
          }}
        >
          <h2 className="font-semibold">איש קשר חדש</h2>
          {fields()}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "שומר..." : "יצירה"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {contacts.length === 0 && !adding && (
          <div className="card text-center text-sm text-gray-500">עדיין אין אנשי קשר.</div>
        )}

        {contacts.map((c, i) =>
          editingId === c.id ? (
            <form
              key={c.id}
              className="card space-y-4"
              action={async (fd) => {
                if (await run(updateContact(fd))) setEditingId(null);
              }}
            >
              <input type="hidden" name="id" value={c.id} />
              <h2 className="font-semibold">עריכת איש קשר</h2>
              {fields(c)}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={busy}>שמירה</button>
                <button type="button" className="btn-secondary" onClick={() => setEditingId(null)}>ביטול</button>
              </div>
            </form>
          ) : (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  {!c.is_visible && (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">מוסתר</span>
                  )}
                </div>
                <p className="text-sm text-gray-600" dir="ltr">
                  {[c.email, c.phone].filter(Boolean).join("  ·  ") || "—"}
                </p>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="flex flex-col">
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === 0}
                    onClick={() => run(moveContact(c.id, "up"))} title="מעלה">▲</button>
                  <button className="text-gray-500 hover:text-brand-600 disabled:opacity-30" disabled={busy || i === contacts.length - 1}
                    onClick={() => run(moveContact(c.id, "down"))} title="מטה">▼</button>
                </div>
                <button className="text-brand-600 hover:underline" disabled={busy}
                  onClick={() => run(toggleContactVisible(c.id, !c.is_visible))}>
                  {c.is_visible ? "הסתר" : "הצג"}
                </button>
                <button className="text-brand-600 hover:underline" onClick={() => { setEditingId(c.id); setAdding(false); }}>
                  עריכה
                </button>
                <button className="text-red-600 hover:underline" disabled={busy}
                  onClick={() => { if (confirm(`למחוק את „${c.name}”?`)) run(deleteContact(c.id)); }}>
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
