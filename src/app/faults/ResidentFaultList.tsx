"use client";

import Link from "next/link";
import {
  STATUS_LABELS,
  STATUS_SHORT_LABELS,
  STATUS_STYLES,
  STATUS_ORDER,
  TREATMENT_TYPE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  formatDate,
  fullName,
  buildingLabel,
  type FaultRow,
  type FaultStatus,
} from "@/lib/types";

/**
 * Visual status tracker — the four stages of a call, with the current one
 * highlighted and earlier ones marked done. The page is RTL, so the first
 * stage (התקבלה) sits on the right.
 */
function StatusTracker({ status }: { status: FaultStatus }) {
  const current = STATUS_ORDER.indexOf(status);

  return (
    <ol className="flex items-start" aria-label="מעקב סטטוס">
      {STATUS_ORDER.map((s, i) => {
        const done = i < current;
        const isCurrent = i === current;
        return (
          <li key={s} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-16 flex-col items-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-brand-500 text-white"
                    : isCurrent
                      ? "bg-brand-500 text-white ring-4 ring-brand-100"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`mt-1 text-center text-[11px] leading-tight ${
                  isCurrent
                    ? "font-semibold text-brand-700"
                    : done
                      ? "text-gray-600"
                      : "text-gray-400"
                }`}
              >
                {STATUS_SHORT_LABELS[s]}
              </span>
            </div>
            {i < STATUS_ORDER.length - 1 && (
              <div
                className={`mt-3.5 h-0.5 flex-1 ${i < current ? "bg-brand-500" : "bg-gray-200"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

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
              <h2 className="mt-1 font-semibold">{buildingLabel(f.building)}</h2>
            </div>
            <div className="text-sm text-gray-500">נפתחה: {formatDate(f.created_at)}</div>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <StatusTracker status={f.status} />
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
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
