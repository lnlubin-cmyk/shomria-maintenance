"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResidentPicker from "@/components/ResidentPicker";
import BuildingPicker from "@/components/BuildingPicker";
import { createFault } from "../actions";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_ORDER,
  PRIORITY_LABELS,
  TREATMENT_TYPE_ORDER,
  TREATMENT_TYPE_LABELS,
  staffName,
  type Building,
} from "@/lib/types";
import type { Worker } from "../EditFaultsDialog";

export default function NewFaultForm({
  buildings,
  defaultBuildingPlot,
  currentResidentId,
  currentResidentName,
  staff = false,
  workers = [],
}: {
  buildings: Building[];
  defaultBuildingPlot: string | null;
  currentResidentId: string | null;
  currentResidentName: string;
  staff?: boolean;
  workers?: Worker[];
}) {
  const router = useRouter();

  // Spec 2a: defaults to the current user, but may be changed to another resident.
  // External staff have no resident of their own, so they start with no caller.
  const [callerId, setCallerId] = useState<string | null>(currentResidentId);
  const [buildingPlot, setBuildingPlot] = useState(defaultBuildingPlot ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Spec 2d: the opening date is today's date, shown and not editable.
  const today = new Date().toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function handleSubmit(formData: FormData) {
    setError(null);

    if (!callerId) {
      setError("יש לבחור שם פונה מתוך רשימת התושבים.");
      return;
    }
    if (!buildingPlot) {
      setError("יש לבחור מבנה.");
      return;
    }

    setBusy(true);
    formData.set("caller_resident_id", callerId);
    formData.set("building_plot_number", buildingPlot);

    const result = await createFault(formData);
    // On success createFault redirects, so reaching here means it failed.
    if (result && "error" in result) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <form action={handleSubmit} className="card space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div>
        <label className="label">שם הפונה *</label>
        <ResidentPicker
          value={callerId}
          initialLabel={currentResidentName}
          onChange={(id) => setCallerId(id)}
        />
        <p className="mt-1 text-xs text-gray-500">
          כברירת מחדל אתה הפונה. ניתן לפתוח קריאה עבור תושב אחר — יש לבחור אותו מתוך הרשימה.
        </p>
      </div>

      <div>
        <label className="label">שם המבנה *</label>
        <BuildingPicker
          buildings={buildings}
          value={buildingPlot}
          onChange={(plot) => setBuildingPlot(plot)}
        />
        {defaultBuildingPlot && (
          <p className="mt-1 text-xs text-gray-500">ברירת המחדל היא המבנה שבו אתה רשום כתושב.</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="fault_description">
          תיאור התקלה *
        </label>
        <textarea
          id="fault_description"
          name="fault_description"
          className="field min-h-28"
          placeholder="תאר את התקלה בקצרה"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">תאריך פתיחת הקריאה</label>
          <input className="field" value={today} disabled readOnly />
        </div>
        <div>
          <label className="label" htmlFor="status">
            סטטוס תקלה
          </label>
          {staff ? (
            <select id="status" name="status" className="field" defaultValue="received">
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          ) : (
            <input className="field" value="פתיחת תקלה" disabled readOnly />
          )}
        </div>
      </div>

      {/* Staff opening a call can fill in the handling fields immediately. */}
      {staff && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700">פרטי טיפול (צוות)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="priority">
                עדיפות
              </label>
              <select id="priority" name="priority" className="field" defaultValue="normal">
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="treatment_type">
                סוג הטיפול
              </label>
              <select id="treatment_type" name="treatment_type" className="field" defaultValue="">
                <option value="">—</option>
                {TREATMENT_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TREATMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="assigned_to_user_id">
                אחריות
              </label>
              <select
                id="assigned_to_user_id"
                name="assigned_to_user_id"
                className="field"
                defaultValue=""
              >
                <option value="">— ללא —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {staffName(w)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="hours_spent">
                שעות עבודה של צוות חצר
              </label>
              <input
                id="hours_spent"
                name="hours_spent"
                className="field"
                type="number"
                min="0"
                step="0.5"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="treatment_description">
              תיאור הטיפול
            </label>
            <textarea id="treatment_description" name="treatment_description" className="field" rows={2} />
          </div>
        </div>
      )}

      <div className="flex gap-3 border-t border-gray-200 pt-4">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "שולח..." : "שלח"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.push("/faults")}
          disabled={busy}
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
