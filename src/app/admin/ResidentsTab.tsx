"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Resident } from "@/lib/types";
import { formatIsraeliPhone } from "@/lib/phone";
import { upsertResident, deleteResident } from "./actions";
import ImportResidents from "./ImportResidents";

export default function ResidentsTab({ residents }: { residents: Resident[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Resident | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter(
      (r) =>
        r.first_name.toLowerCase().includes(q) ||
        r.last_name.toLowerCase().includes(q) ||
        r.id.includes(q) ||
        r.phone.includes(q)
    );
  }, [residents, query]);

  async function run(action: (fd: FormData) => Promise<any>, fd: FormData) {
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

      <ImportResidents onImported={() => router.refresh()} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-xs"
          placeholder="חיפוש לפי שם, ת.ז. או טלפון"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{rows.length} תושבים</span>
          <button
            className="btn-primary"
            onClick={() => {
              setAdding((v) => !v);
              setEditing(null);
            }}
          >
            {adding ? "ביטול" : "הוספת תושב"}
          </button>
        </div>
      </div>

      {(adding || editing) && (
        <form
          // Remount on target change — see BuildingsTab. A field the user has
          // typed into goes dirty and would otherwise keep the stale value.
          key={editing?.id ?? "new"}
          className="card space-y-4"
          action={async (fd) => {
            if (await run(upsertResident, fd)) {
              setAdding(false);
              setEditing(null);
            }
          }}
        >
          <h2 className="font-semibold">{editing ? "עריכת תושב" : "תושב חדש"}</h2>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="id">
                תעודת זהות *
              </label>
              <input
                id="id"
                name="id"
                className="field"
                dir="ltr"
                defaultValue={editing?.id}
                readOnly={Boolean(editing)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="first_name">
                שם פרטי *
              </label>
              <input
                id="first_name"
                name="first_name"
                className="field"
                defaultValue={editing?.first_name}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="last_name">
                שם משפחה *
              </label>
              <input
                id="last_name"
                name="last_name"
                className="field"
                defaultValue={editing?.last_name}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                מספר טלפון *
              </label>
              <input
                id="phone"
                name="phone"
                className="field"
                dir="ltr"
                placeholder="050-123-4567"
                defaultValue={editing?.phone}
                required
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="email">
              אימייל
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              dir="ltr"
              placeholder="you@example.com"
              defaultValue={editing?.email ?? ""}
            />
            <p className="mt-1 text-xs text-gray-500">
              משמש לכניסה למערכת. חובה כדי ליצור לתושב חשבון.
            </p>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "שומר..." : "שמירה"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              ביטול
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-3">תעודת זהות</th>
              <th className="px-3 py-3">שם פרטי</th>
              <th className="px-3 py-3">שם משפחה</th>
              <th className="px-3 py-3">טלפון</th>
              <th className="px-3 py-3">אימייל</th>
              <th className="px-3 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                  לא נמצאו תושבים.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-3" dir="ltr">
                  {r.id}
                </td>
                <td className="px-3 py-3">{r.first_name}</td>
                <td className="px-3 py-3">{r.last_name}</td>
                <td className="px-3 py-3" dir="ltr">
                  {formatIsraeliPhone(r.phone)}
                </td>
                <td className="px-3 py-3" dir="ltr">
                  {r.email ?? <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-3">
                    <button
                      className="text-sm text-brand-600 hover:underline"
                      onClick={() => {
                        setEditing(r);
                        setAdding(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      עריכה
                    </button>
                    <form
                      action={async (fd) => {
                        await run(deleteResident, fd);
                      }}
                      onSubmit={(e) => {
                        if (!confirm(`למחוק את ${r.first_name} ${r.last_name}?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        מחיקה
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
