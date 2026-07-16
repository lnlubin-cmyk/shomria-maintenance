"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Building, Resident } from "@/lib/types";
import { upsertBuilding, deleteBuilding } from "./actions";

export default function BuildingsTab({
  buildings,
  residents,
}: {
  buildings: Building[];
  residents: Resident[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Building | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buildings;
    return buildings.filter(
      (b) =>
        b.building_name.toLowerCase().includes(q) ||
        b.plot_number.toLowerCase().includes(q) ||
        (b.street_name ?? "").toLowerCase().includes(q)
    );
  }, [buildings, query]);

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

  function residentName(id: string | null) {
    if (!id) return null;
    const r = byId.get(id);
    return r ? `${r.first_name} ${r.last_name}` : id;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-xs"
          placeholder="חיפוש לפי שם מבנה, מגרש או רחוב"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{rows.length} מבנים</span>
          <button
            className="btn-primary"
            onClick={() => {
              setAdding((v) => !v);
              setEditing(null);
            }}
          >
            {adding ? "ביטול" : "הוספת מבנה"}
          </button>
        </div>
      </div>

      {(adding || editing) && (
        <form
          // Remount on target change. defaultValue is only applied at mount, so
          // switching from editing A to editing B would otherwise leave A's
          // residents in the selects and save them onto B.
          key={editing?.plot_number ?? "new"}
          className="card space-y-4"
          action={async (fd) => {
            if (await run(upsertBuilding, fd)) {
              setAdding(false);
              setEditing(null);
            }
          }}
        >
          <h2 className="font-semibold">{editing ? "עריכת מבנה" : "מבנה חדש"}</h2>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="plot_number">
                מספר מגרש *
              </label>
              <input
                id="plot_number"
                name="plot_number"
                className="field"
                dir="ltr"
                defaultValue={editing?.plot_number}
                readOnly={Boolean(editing)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="building_name">
                שם המבנה *
              </label>
              <input
                id="building_name"
                name="building_name"
                className="field"
                defaultValue={editing?.building_name}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="street_name">
                שם רחוב
              </label>
              <input
                id="street_name"
                name="street_name"
                className="field"
                defaultValue={editing?.street_name ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="house_number">
                מספר בית
              </label>
              <input
                id="house_number"
                name="house_number"
                className="field"
                dir="ltr"
                defaultValue={editing?.house_number ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {([1, 2, 3, 4] as const).map((n) => {
              const key = `resident_${n}` as const;
              return (
                <div key={n}>
                  <label className="label" htmlFor={key}>
                    תושב {n}
                  </label>
                  <select
                    id={key}
                    name={key}
                    className="field"
                    defaultValue={editing?.[key] ?? ""}
                  >
                    <option value="">— ללא —</option>
                    {residents.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.first_name} {r.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
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
        <table className="w-full min-w-[820px] text-right text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-3">מגרש</th>
              <th className="px-3 py-3">שם המבנה</th>
              <th className="px-3 py-3">כתובת</th>
              <th className="px-3 py-3">תושבים</th>
              <th className="px-3 py-3">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-gray-500">
                  לא נמצאו מבנים.
                </td>
              </tr>
            )}
            {rows.map((b) => {
              const occupants = [b.resident_1, b.resident_2, b.resident_3, b.resident_4]
                .map(residentName)
                .filter(Boolean);

              return (
                <tr key={b.plot_number} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium" dir="ltr">
                    {b.plot_number}
                  </td>
                  <td className="px-3 py-3">{b.building_name}</td>
                  <td className="px-3 py-3">
                    {b.street_name ? `${b.street_name} ${b.house_number ?? ""}`.trim() : "—"}
                  </td>
                  <td className="px-3 py-3">{occupants.length ? occupants.join(", ") : "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-3">
                      <button
                        className="text-sm text-brand-600 hover:underline"
                        onClick={() => {
                          setEditing(b);
                          setAdding(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        עריכה
                      </button>
                      <form
                        action={async (fd) => {
                          await run(deleteBuilding, fd);
                        }}
                        onSubmit={(e) => {
                          if (!confirm(`למחוק את המבנה "${b.building_name}"?`)) e.preventDefault();
                        }}
                      >
                        <input type="hidden" name="plot_number" value={b.plot_number} />
                        <button type="submit" className="text-sm text-red-600 hover:underline">
                          מחיקה
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
