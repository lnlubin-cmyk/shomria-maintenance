"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPE_ORDER,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PRIORITY_STYLES,
  formatDate,
  fullName,
  type FaultRow,
  type FaultStatus,
  type TreatmentType,
  type FaultPriority,
} from "@/lib/types";
import { updateFaults, deleteFaults } from "./actions";
import EditFaultsDialog, { type Worker } from "./EditFaultsDialog";

type SortDir = "desc" | "asc";

const EMPTY_FILTERS = {
  fault_number: "",
  caller: "",
  building: "",
  description: "",
  status: "",
  priority: "",
  assignee: "",
  treatment_description: "",
  treatment_type: "",
  created_at: "",
};

export default function StaffFaultTable({
  faults,
  canDelete,
  workers,
}: {
  faults: FaultRow[];
  canDelete: boolean;
  workers: Worker[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Spec asks for descending by date; the header toggles to ascending.
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Spec: "המשתמש יוכל לסנן לפי כל אחד מהשדות" — every column filters.
  const rows = useMemo(() => {
    const has = (haystack: string | null | undefined, needle: string) =>
      !needle || (haystack ?? "").toLowerCase().includes(needle.toLowerCase());

    const filtered = faults.filter(
      (f) =>
        has(String(f.fault_number), filters.fault_number) &&
        has(fullName(f.caller), filters.caller) &&
        has(f.building?.building_name, filters.building) &&
        has(f.fault_description, filters.description) &&
        (!filters.status || f.status === filters.status) &&
        (!filters.priority || f.priority === filters.priority) &&
        has(fullName(f.assignee?.resident), filters.assignee) &&
        has(f.treatment_description, filters.treatment_description) &&
        (!filters.treatment_type || f.treatment_type === filters.treatment_type) &&
        has(formatDate(f.created_at), filters.created_at)
    );

    // Sort by open date. Copy first — sort mutates, and faults is a prop.
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? diff : -diff;
    });
  }, [faults, filters, sortDir]);

  const allVisibleSelected = rows.length > 0 && rows.every((f) => selected.has(f.fault_number));

  function toggleRow(n: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        rows.forEach((f) => next.delete(f.fault_number));
      } else {
        rows.forEach((f) => next.add(f.fault_number));
      }
      return next;
    });
  }

  async function handleSave(patch: {
    status?: FaultStatus | "";
    treatment_type?: TreatmentType | "";
    priority?: FaultPriority | "";
    treatment_description?: string | null;
    assigned_to_user_id?: string | "";
  }) {
    setError(null);
    setBusy(true);

    const fd = new FormData();
    selected.forEach((n) => fd.append("fault_numbers", String(n)));
    if (patch.status) fd.set("status", patch.status);
    if (patch.treatment_type) fd.set("treatment_type", patch.treatment_type);
    if (patch.priority) fd.set("priority", patch.priority);
    if (patch.assigned_to_user_id) fd.set("assigned_to_user_id", patch.assigned_to_user_id);
    if (patch.treatment_description !== undefined && patch.treatment_description !== null) {
      fd.set("treatment_description", patch.treatment_description);
    }

    const result = await updateFaults(fd);
    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setEditing(false);
    setSelected(new Set());
    router.refresh();
  }

  async function handleDelete() {
    const n = selected.size;
    if (!confirm(`למחוק ${n} ${n === 1 ? "תקלה" : "תקלות"}? הפעולה אינה הפיכה.`)) return;

    setError(null);
    setBusy(true);

    const fd = new FormData();
    selected.forEach((x) => fd.append("fault_numbers", String(x)));

    const result = await deleteFaults(fd);
    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSelected(new Set());
    router.refresh();
  }

  const filtersActive = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-600">
          {rows.length} מתוך {faults.length} תקלות
          {selected.size > 0 && ` · ${selected.size} נבחרו`}
        </span>

        {/* Spec: the edit button appears once at least one row is selected. */}
        {selected.size > 0 && (
          <button className="btn-primary" onClick={() => setEditing(true)} disabled={busy}>
            עריכה
          </button>
        )}

        {/* Spec: delete is מנהל תחזוקה only. */}
        {selected.size > 0 && canDelete && (
          <button className="btn-danger" onClick={handleDelete} disabled={busy}>
            מחיקת תקלות
          </button>
        )}

        {filtersActive && (
          <button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            ניקוי סינון
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[1100px] text-right text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="בחר הכל"
                  className="h-4 w-4"
                />
              </th>
              <th className="px-3 py-3">מס׳</th>
              <th className="px-3 py-3">שם הפונה</th>
              <th className="px-3 py-3">שם המבנה</th>
              <th className="px-3 py-3">תיאור התקלה</th>
              <th className="px-3 py-3">סטטוס</th>
              <th className="px-3 py-3">עדיפות</th>
              <th className="px-3 py-3">אחריות</th>
              <th className="px-3 py-3">תיאור הטיפול</th>
              <th className="px-3 py-3">סוג הטיפול</th>
              <th className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  className="flex items-center gap-1 font-inherit uppercase hover:text-gray-900"
                  title="מיון לפי תאריך פתיחה"
                >
                  נפתחה
                  <span aria-hidden="true">{sortDir === "desc" ? "▼" : "▲"}</span>
                </button>
              </th>
              <th className="px-3 py-3">נסגרה</th>
            </tr>
            <tr className="border-t border-gray-200">
              <th />
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.fault_number}
                  onChange={(v) => setFilters({ ...filters, fault_number: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.caller}
                  onChange={(v) => setFilters({ ...filters, caller: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.building}
                  onChange={(v) => setFilters({ ...filters, building: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.description}
                  onChange={(v) => setFilters({ ...filters, description: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">הכל</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 pb-2">
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal"
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                >
                  <option value="">הכל</option>
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.assignee}
                  onChange={(v) => setFilters({ ...filters, assignee: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.treatment_description}
                  onChange={(v) => setFilters({ ...filters, treatment_description: v })}
                />
              </th>
              <th className="px-2 pb-2">
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal"
                  value={filters.treatment_type}
                  onChange={(e) => setFilters({ ...filters, treatment_type: e.target.value })}
                >
                  <option value="">הכל</option>
                  {TREATMENT_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TREATMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.created_at}
                  onChange={(v) => setFilters({ ...filters, created_at: v })}
                />
              </th>
              <th />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-10 text-center text-gray-500">
                  לא נמצאו תקלות התואמות את הסינון.
                </td>
              </tr>
            )}

            {rows.map((f) => (
              <tr
                key={f.fault_number}
                className={selected.has(f.fault_number) ? "bg-brand-50" : "hover:bg-gray-50"}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selected.has(f.fault_number)}
                    onChange={() => toggleRow(f.fault_number)}
                    aria-label={`בחירת תקלה ${f.fault_number}`}
                  />
                </td>
                <td className="px-3 py-3 font-medium">{f.fault_number}</td>
                <td className="px-3 py-3">{fullName(f.caller)}</td>
                <td className="px-3 py-3">{f.building?.building_name ?? "—"}</td>
                <td className="max-w-56 px-3 py-3">
                  <div className="truncate" title={f.fault_description}>
                    {f.fault_description}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}
                  >
                    {STATUS_LABELS[f.status]}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[f.priority]}`}
                  >
                    {PRIORITY_LABELS[f.priority]}
                  </span>
                </td>
                <td className="px-3 py-3">{fullName(f.assignee?.resident)}</td>
                <td className="max-w-56 px-3 py-3">
                  <div className="truncate" title={f.treatment_description ?? ""}>
                    {f.treatment_description || "—"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {f.treatment_type ? TREATMENT_TYPE_LABELS[f.treatment_type] : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(f.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(f.closed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditFaultsDialog
          count={selected.size}
          single={selected.size === 1 ? faults.find((f) => selected.has(f.fault_number)) : undefined}
          workers={workers}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function FilterInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal"
      placeholder="סינון"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
