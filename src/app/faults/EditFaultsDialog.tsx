"use client";

import { useState } from "react";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPE_ORDER,
  fullName,
  type FaultRow,
  type FaultStatus,
  type TreatmentType,
} from "@/lib/types";

export interface Worker {
  id: string;
  role: string;
  resident: { first_name: string; last_name: string } | null;
}

/**
 * Spec: staff may edit only status (known values only), treatment description
 * (free text), and treatment type (valid values only). אחריות is also editable
 * here — the spec defines the field but never says where it gets assigned, and
 * this is the only screen staff work from.
 *
 * Supports multi-select: a blank dropdown means "leave unchanged", so several
 * faults can be moved to one status without overwriting their other fields.
 */
export default function EditFaultsDialog({
  count,
  single,
  workers,
  busy,
  onCancel,
  onSave,
}: {
  count: number;
  single?: FaultRow;
  workers: Worker[];
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: {
    status?: FaultStatus | "";
    treatment_type?: TreatmentType | "";
    treatment_description?: string | null;
    assigned_to_user_id?: string | "";
  }) => void;
}) {
  const [status, setStatus] = useState<FaultStatus | "">(single?.status ?? "");
  const [treatmentType, setTreatmentType] = useState<TreatmentType | "">(
    single?.treatment_type ?? ""
  );
  const [treatmentDescription, setTreatmentDescription] = useState(
    single?.treatment_description ?? ""
  );
  const [assignee, setAssignee] = useState<string>(single?.assigned_to_user_id ?? "");
  // For a bulk edit, only overwrite the description if explicitly opted in —
  // otherwise one edit would wipe every selected fault's existing notes.
  const [writeDescription, setWriteDescription] = useState(Boolean(single));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      status,
      treatment_type: treatmentType,
      treatment_description: writeDescription ? treatmentDescription : undefined,
      // Only send the assignee if it actually changed. Resubmitting an
      // unchanged one re-validates it, so a worker who has since been demoted
      // would block an unrelated status edit. "" means "leave unchanged".
      assigned_to_user_id: assignee === (single?.assigned_to_user_id ?? "") ? "" : assignee,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold">
          {single ? `עריכת תקלה #${single.fault_number}` : `עריכת ${count} תקלות`}
        </h2>
        {!single && (
          <p className="mt-1 text-sm text-gray-600">
            השינויים יחולו על כל התקלות שנבחרו. שדה שיישאר ריק לא ישתנה.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="status">
              סטטוס
            </label>
            <select
              id="status"
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value as FaultStatus | "")}
            >
              <option value="">{single ? "— בחר —" : "— ללא שינוי —"}</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="treatment_type">
              סוג הטיפול
            </label>
            <select
              id="treatment_type"
              className="field"
              value={treatmentType}
              onChange={(e) => setTreatmentType(e.target.value as TreatmentType | "")}
            >
              <option value="">{single ? "— בחר —" : "— ללא שינוי —"}</option>
              {TREATMENT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TREATMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="assignee">
              אחריות
            </label>
            <select
              id="assignee"
              className="field"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">{single ? "— בחר —" : "— ללא שינוי —"}</option>
              <option value="__none__">— ללא אחראי —</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {fullName(w.resident)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="treatment_description">
                תיאור הטיפול
              </label>
              {!single && (
                <label className="mb-1 flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={writeDescription}
                    onChange={(e) => setWriteDescription(e.target.checked)}
                  />
                  עדכן בכל התקלות שנבחרו
                </label>
              )}
            </div>
            <textarea
              id="treatment_description"
              className="field min-h-24"
              value={treatmentDescription}
              disabled={!writeDescription}
              onChange={(e) => setTreatmentDescription(e.target.value)}
              placeholder="תאר את הטיפול שבוצע"
            />
          </div>

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "שומר..." : "שמירה"}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
