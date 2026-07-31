"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  staffName,
  buildingLabel,
  type FaultRow,
  type FaultStatus,
  type TreatmentType,
  type FaultPriority,
} from "@/lib/types";
import { updateFaults, deleteFaults } from "./actions";
import EditFaultsDialog, { type Worker } from "./EditFaultsDialog";
import HouseInfoDialog, { type HouseOption } from "./HouseInfoDialog";

type SortDir = "desc" | "asc";

const EMPTY_FILTERS = {
  fault_number: "",
  caller: "",
  building: "",
  building_plot: "",
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
  canSeeFeedback,
  canExport,
  workers,
  buildings,
}: {
  faults: FaultRow[];
  canDelete: boolean;
  canSeeFeedback: boolean;
  canExport: boolean;
  workers: Worker[];
  buildings: HouseOption[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  // Spec asks for descending by date; the header toggles to ascending.
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [houseInfoOpen, setHouseInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Show a manageable number of calls; adjustable, default 5.
  const [pageSize, setPageSize] = useState<number | "all">(5);
  const [page, setPage] = useState(0);

  // Spec: "המשתמש יוכל לסנן לפי כל אחד מהשדות" — every column filters.
  const rows = useMemo(() => {
    const has = (haystack: string | null | undefined, needle: string) =>
      !needle || (haystack ?? "").toLowerCase().includes(needle.toLowerCase());

    const filtered = faults.filter(
      (f) =>
        has(String(f.fault_number), filters.fault_number) &&
        has(fullName(f.caller), filters.caller) &&
        has(f.building ? buildingLabel(f.building) : "", filters.building) &&
        has(f.building_plot_number, filters.building_plot) &&
        has(f.fault_description, filters.description) &&
        (!filters.status || f.status === filters.status) &&
        (!filters.priority || f.priority === filters.priority) &&
        has(staffName(f.assignee), filters.assignee) &&
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

  // Reset to the first page when the filtered set or page size changes.
  useEffect(() => setPage(0), [filters, sortDir, pageSize]);

  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows =
    pageSize === "all" ? rows : rows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const allVisibleSelected =
    pagedRows.length > 0 && pagedRows.every((f) => selected.has(f.fault_number));

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
        pagedRows.forEach((f) => next.delete(f.fault_number));
      } else {
        pagedRows.forEach((f) => next.add(f.fault_number));
      }
      return next;
    });
  }

  // Selection actions. One call → the single-call page; several → multi-view /
  // the bulk-edit dialog.
  function handleView() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (ids.length === 1) router.push(`/faults/${ids[0]}?view=1`);
    else router.push(`/faults/view?ids=${ids.join(",")}`);
  }

  function handleUpdate() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (ids.length === 1) router.push(`/faults/${ids[0]}`);
    else setEditing(true);
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

  // Export the currently filtered + sorted rows (the whole view, not just the
  // visible page) to a real .xlsx. xlsx is loaded on demand so it doesn't weigh
  // down the page for everyone.
  async function exportExcel() {
    if (rows.length === 0) return;
    const XLSX = await import("xlsx");
    const data = rows.map((f) => ({
      "מס׳": f.fault_number,
      "שם הפונה": fullName(f.caller),
      "שם המבנה": buildingLabel(f.building),
      מגרש: f.building_plot_number,
      "תיאור התקלה": f.fault_description,
      סטטוס: STATUS_LABELS[f.status],
      עדיפות: PRIORITY_LABELS[f.priority],
      אחריות: staffName(f.assignee),
      "תיאור הטיפול": f.treatment_description ?? "",
      "סוג הטיפול": f.treatment_type ? TREATMENT_TYPE_LABELS[f.treatment_type] : "",
      "עלות (₪)": Number(f.total_cost) || 0,
      שעות: f.hours_spent ?? "",
      נפתחה: formatDate(f.created_at),
      נסגרה: f.closed_at ? formatDate(f.closed_at) : "",
      "דירוג התושב": f.feedback_rating ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    // Show the sheet right-to-left in Excel (not in the 0.18 typings).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ws as any)["!views"] = [{ RTL: true }];
    ws["!cols"] = [6, 18, 22, 8, 40, 16, 10, 16, 32, 12, 11, 8, 12, 12, 11].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תקלות");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `תקלות-${date}.xlsx`);
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

        {/* View: one call opens its page; several show one after another. */}
        {selected.size > 0 && (
          <button className="btn-secondary" onClick={handleView} disabled={busy}>
            צפייה
          </button>
        )}

        {/* Update: one call opens its page; several use the bulk-edit dialog. */}
        {selected.size > 0 && (
          <button className="btn-primary" onClick={handleUpdate} disabled={busy}>
            {selected.size === 1 ? "עדכון תקלה" : "עדכון תקלות"}
          </button>
        )}

        {/* Delete is מנהל תחזוקה only. */}
        {selected.size > 0 && canDelete && (
          <button className="btn-danger" onClick={handleDelete} disabled={busy}>
            {selected.size === 1 ? "מחיקת תקלה" : "מחיקת תקלות"}
          </button>
        )}

        {filtersActive && (
          <button className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            ניקוי סינון
          </button>
        )}

        <div className="ms-auto flex flex-wrap gap-2">
          {canExport && (
            <button className="btn-secondary" onClick={exportExcel} disabled={rows.length === 0}>
              ייצוא לאקסל
            </button>
          )}
          <button className="btn-secondary" onClick={() => setHouseInfoOpen(true)}>
            הוסף מידע שימושי על בית
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[1400px] text-right text-sm">
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
              <th className="px-3 py-3">מגרש</th>
              <th className="px-3 py-3">תיאור התקלה</th>
              <th className="px-3 py-3">סטטוס</th>
              <th className="px-3 py-3">עדיפות</th>
              <th className="px-3 py-3">אחריות</th>
              <th className="px-3 py-3">תיאור הטיפול</th>
              <th className="px-3 py-3">סוג הטיפול</th>
              <th className="px-3 py-3">עלות</th>
              <th className="px-3 py-3">שעות</th>
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
              {canSeeFeedback && <th className="px-3 py-3">דירוג</th>}
              <th className="px-3 py-3">פעולות</th>
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
                  value={filters.building_plot}
                  onChange={(v) => setFilters({ ...filters, building_plot: v })}
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
              <th />
              <th />
              <th className="px-2 pb-2">
                <FilterInput
                  value={filters.created_at}
                  onChange={(v) => setFilters({ ...filters, created_at: v })}
                />
              </th>
              <th />
              {canSeeFeedback && <th />}
              <th />
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={canSeeFeedback ? 17 : 16} className="px-3 py-10 text-center text-gray-500">
                  לא נמצאו תקלות התואמות את הסינון.
                </td>
              </tr>
            )}

            {pagedRows.map((f) => (
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
                <td className="px-3 py-3">{buildingLabel(f.building)}</td>
                <td className="px-3 py-3 tabular-nums" dir="ltr">
                  {f.building_plot_number}
                </td>
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
                <td className="px-3 py-3">{staffName(f.assignee)}</td>
                <td className="max-w-56 px-3 py-3">
                  <div className="truncate" title={f.treatment_description ?? ""}>
                    {f.treatment_description || "—"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  {f.treatment_type ? TREATMENT_TYPE_LABELS[f.treatment_type] : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums" dir="ltr">
                  {Number(f.total_cost) > 0 ? `${Number(f.total_cost).toLocaleString("he-IL")} ₪` : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums" dir="ltr">
                  {f.hours_spent != null ? f.hours_spent : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(f.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-3">{formatDate(f.closed_at)}</td>
                {canSeeFeedback && (
                  <td className="whitespace-nowrap px-3 py-3" dir="ltr">
                    {f.feedback_rating != null ? (
                      <span className="tabular-nums">
                        <span className="text-amber-400">★</span> {f.feedback_rating}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-3">
                  <div className="flex gap-3">
                    <Link href={`/faults/${f.fault_number}`} className="text-brand-600 hover:underline">
                      עדכון
                    </Link>
                    <Link href={`/faults/${f.fault_number}?view=1`} className="text-gray-600 hover:underline">
                      צפייה
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          הצג
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="all">הכל</option>
          </select>
          קריאות בעמוד
        </label>

        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex items-center gap-3 text-sm">
            <button
              className="btn-secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              הקודם
            </button>
            <span className="text-gray-600">
              עמוד {currentPage + 1} מתוך {totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              הבא
            </button>
          </div>
        )}
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

      {houseInfoOpen && (
        <HouseInfoDialog buildings={buildings} onClose={() => setHouseInfoOpen(false)} />
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
