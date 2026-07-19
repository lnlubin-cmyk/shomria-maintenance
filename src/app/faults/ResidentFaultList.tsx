"use client";

import Link from "next/link";
import {
  STATUS_LABELS,
  STATUS_STYLES,
  TREATMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  formatDate,
  fullName,
  type FaultRow,
} from "@/lib/types";

/**
 * Spec: "בדיקת סטטוס קריאה" for a resident. Read-only — a resident never edits
 * status, treatment description, or treatment type.
 */
export default function ResidentFaultList({ faults }: { faults: FaultRow[] }) {
  if (faults.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-gray-600">אין קריאות פתוחות על שמך.</p>
        <Link href="/faults/new" className="btn-primary mt-4">
          פתיחת קריאה חדשה
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {faults.map((f) => (
        <article key={f.fault_number} className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">קריאה #{f.fault_number}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[f.status]}`}
                >
                  {STATUS_LABELS[f.status]}
                </span>
              </div>
              <h2 className="mt-1 font-semibold">{f.building?.building_name ?? "—"}</h2>
            </div>
            <div className="text-sm text-gray-500">נפתחה: {formatDate(f.created_at)}</div>
          </div>

          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">שם הפונה</dt>
              <dd className="font-medium">{fullName(f.caller)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">סוג הטיפול</dt>
              <dd className="font-medium">
                {f.treatment_type ? TREATMENT_TYPE_LABELS[f.treatment_type] : "טרם נקבע"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">עדיפות</dt>
              <dd>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[f.priority]}`}
                >
                  {PRIORITY_LABELS[f.priority]}
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">תיאור התקלה</dt>
              <dd className="whitespace-pre-wrap">{f.fault_description}</dd>
            </div>
            {f.treatment_description && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">תיאור הטיפול</dt>
                <dd className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3">
                  {f.treatment_description}
                </dd>
              </div>
            )}
            {f.closed_at && (
              <div>
                <dt className="text-gray-500">תאריך סגירה</dt>
                <dd className="font-medium">{formatDate(f.closed_at)}</dd>
              </div>
            )}
          </dl>
        </article>
      ))}
    </div>
  );
}
