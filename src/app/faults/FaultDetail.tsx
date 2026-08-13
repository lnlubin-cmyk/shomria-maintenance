"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AiAdvicePanel from "./AiAdvicePanel";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_STYLES,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PRIORITY_STYLES,
  TREATMENT_TYPE_LABELS,
  TREATMENT_TYPE_ORDER,
  buildingLabel,
  callerDisplay,
  staffName,
  formatDate,
  formatDateTime,
  type FaultStatus,
  type FaultPriority,
  type TreatmentType,
  type FaultMessage,
  type FaultCostItem,
  type BuildingFact,
  type NamedUser,
} from "@/lib/types";
import {
  updateFaults,
  resendFaultMessage,
  addCostItem,
  deleteCostItem,
  addBuildingFact,
  deleteBuildingFact,
} from "./actions";
import type { Worker } from "./EditFaultsDialog";

interface DetailFault {
  fault_number: number;
  building_plot_number: string;
  fault_description: string;
  status: FaultStatus;
  priority: FaultPriority;
  assigned_to_user_id: string | null;
  treatment_description: string | null;
  treatment_type: TreatmentType | null;
  hours_spent: number | null;
  total_cost: number;
  closed_at: string | null;
  created_at: string;
  caller: { first_name: string; last_name: string; phone: string } | null;
  caller_name: string | null;
  building: { building_name: string; layer: { prefix: string } | null } | null;
  assignee: NamedUser | null;
}

const shekels = (n: number | string) => `${Number(n).toLocaleString("he-IL")} ₪`;

export default function FaultDetail({
  fault,
  messages,
  costItems,
  facts = [],
  workers,
  staff,
  mode,
  embedded = false,
  feedbackRating = null,
  canSeeFeedback = false,
  aiConfigured = false,
}: {
  fault: DetailFault;
  messages: FaultMessage[];
  costItems: FaultCostItem[];
  facts?: BuildingFact[];
  workers: Worker[];
  staff: boolean;
  mode: "edit" | "view";
  embedded?: boolean;
  feedbackRating?: number | null;
  canSeeFeedback?: boolean;
  aiConfigured?: boolean;
}) {
  const router = useRouter();
  const editable = staff && mode === "edit";

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // fault edit form
  const [status, setStatus] = useState<FaultStatus>(fault.status);
  const [priority, setPriority] = useState<FaultPriority>(fault.priority);
  const [treatmentType, setTreatmentType] = useState<TreatmentType | "">(fault.treatment_type ?? "");
  const [treatment, setTreatment] = useState(fault.treatment_description ?? "");
  const [assignee, setAssignee] = useState(fault.assigned_to_user_id ?? "");
  const [hours, setHours] = useState(fault.hours_spent != null ? String(fault.hours_spent) : "");

  // messages
  const [showMessages, setShowMessages] = useState(false);

  // cost
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");

  // house info (building facts)
  const [factKey, setFactKey] = useState("");
  const [factValue, setFactValue] = useState("");

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

  async function saveFault() {
    const fd = new FormData();
    fd.append("fault_numbers", String(fault.fault_number));
    fd.set("status", status);
    fd.set("priority", priority);
    if (treatmentType) fd.set("treatment_type", treatmentType);
    fd.set("treatment_description", treatment);
    fd.set("assigned_to_user_id", assignee || "__none__");
    fd.set("hours_spent", hours);
    await run(updateFaults(fd));
  }

  async function addCost() {
    if (await run(addCostItem(fault.fault_number, costDesc, costAmount))) {
      setCostDesc("");
      setCostAmount("");
    }
  }

  async function addFact() {
    if (await run(addBuildingFact(fault.building_plot_number, factKey, factValue))) {
      setFactKey("");
      setFactValue("");
    }
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <Link href="/faults" className="text-sm text-brand-600 hover:underline">
            ← חזרה לרשימת הקריאות
          </Link>
          {staff && (
            <Link
              href={mode === "edit" ? `/faults/${fault.fault_number}?view=1` : `/faults/${fault.fault_number}`}
              className="text-sm text-gray-500 hover:underline"
            >
              {mode === "edit" ? "מצב צפייה" : "מצב עריכה"}
            </Link>
          )}
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* Summary */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">קריאה #{fault.fault_number}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[fault.status]}`}>
            {STATUS_LABELS[fault.status]}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[fault.priority]}`}>
            {PRIORITY_LABELS[fault.priority]}
          </span>
        </div>

        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="שם הפונה" value={callerDisplay(fault)} />
          {staff && <Row label="טלפון" value={fault.caller?.phone ?? "—"} ltr />}
          <Row label="מבנה" value={buildingLabel(fault.building)} />
          <Row label="נפתחה" value={formatDate(fault.created_at)} />
          <Row label="נסגרה" value={formatDate(fault.closed_at)} />
          <Row label="אחריות" value={staffName(fault.assignee)} />
        </dl>

        <div>
          <dt className="text-sm text-gray-500">תיאור התקלה</dt>
          <dd className="mt-0.5 whitespace-pre-line text-sm text-gray-800">{fault.fault_description}</dd>
        </div>

        {canSeeFeedback && feedbackRating != null && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-sm">
            <span className="text-gray-500">דירוג התושב לטיפול:</span>
            <span dir="ltr">
              <span className="text-amber-400">{"★".repeat(feedbackRating)}</span>
              <span className="text-gray-300">{"★".repeat(5 - feedbackRating)}</span>
            </span>
            <span className="text-gray-600">({feedbackRating}/5)</span>
          </div>
        )}
      </div>

      {/* Staff: AI advice (history summary + recommendation). Not in the compact
          multi-fault embedded view. */}
      {staff && !embedded && (
        <AiAdvicePanel faultNumber={fault.fault_number} configured={aiConfigured} />
      )}

      {/* Staff edit / read-only treatment */}
      {staff && (
        <div className="card space-y-4">
          <h2 className="font-semibold">טיפול</h2>
          {editable ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="סטטוס">
                  <select className="field" value={status} onChange={(e) => setStatus(e.target.value as FaultStatus)}>
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="עדיפות">
                  <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as FaultPriority)}>
                    {PRIORITY_ORDER.map((p) => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="סוג הטיפול">
                  <select className="field" value={treatmentType} onChange={(e) => setTreatmentType(e.target.value as TreatmentType | "")}>
                    <option value="">—</option>
                    {TREATMENT_TYPE_ORDER.map((t) => (
                      <option key={t} value={t}>{TREATMENT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="אחריות">
                  <select className="field" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">— ללא —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{staffName(w)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="שעות עבודה של צוות חצר">
                  <input className="field" type="number" min="0" step="0.5" dir="ltr" value={hours} onChange={(e) => setHours(e.target.value)} />
                </Field>
              </div>
              <Field label="תיאור הטיפול">
                <textarea className="field" rows={2} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
              </Field>
              <button className="btn-primary" disabled={busy} onClick={saveFault}>
                {busy ? "שומר..." : "שמירת הטיפול"}
              </button>
            </>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="סוג הטיפול" value={fault.treatment_type ? TREATMENT_TYPE_LABELS[fault.treatment_type] : "—"} />
              <Row label="שעות עבודה" value={fault.hours_spent != null ? String(fault.hours_spent) : "—"} ltr />
              <div className="sm:col-span-2">
                <dt className="text-gray-500">תיאור הטיפול</dt>
                <dd className="mt-0.5 whitespace-pre-line text-gray-800">{fault.treatment_description || "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {/* House info (building facts) — staff only */}
      {staff && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">מידע שימושי על הבית</h2>
            <span className="text-xs text-gray-500" dir="ltr">
              {buildingLabel(fault.building)} · {fault.building_plot_number}
            </span>
          </div>

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {facts.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-gray-500">לא נשמר מידע על הבית.</li>
            )}
            {facts.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-gray-800">{f.key}:</span>
                  <span className="text-gray-700">{f.value || "—"}</span>
                </span>
                {editable && (
                  <button
                    className="shrink-0 text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => run(deleteBuildingFact(f.id, fault.building_plot_number))}
                  >
                    הסר
                  </button>
                )}
              </li>
            ))}
          </ul>

          {editable && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="label">שדה</label>
                <input
                  className="field"
                  placeholder="לדוגמה: קוטר צינור"
                  value={factKey}
                  onChange={(e) => setFactKey(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="label">ערך</label>
                <input
                  className="field"
                  placeholder="לדוגמה: 18"
                  value={factValue}
                  onChange={(e) => setFactValue(e.target.value)}
                />
              </div>
              <button className="btn-secondary" disabled={busy || !factKey.trim()} onClick={addFact}>
                הוספה
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="card space-y-3">
        <button
          type="button"
          onClick={() => setShowMessages((v) => !v)}
          className="flex w-full items-center justify-between text-right"
        >
          <span className="font-semibold">הודעות לתושב ({messages.length})</span>
          <span className="text-gray-400">{showMessages ? "▲" : "▼"}</span>
        </button>

        {showMessages && (
          <ul className="space-y-2">
            {messages.length === 0 && <li className="text-sm text-gray-500">לא נשלחו הודעות.</li>}
            {messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="whitespace-pre-line text-sm text-gray-800">{m.body}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{formatDateTime(m.created_at)}</span>
                  <span>{m.is_automatic ? "הודעה אוטומטית" : staffName(m.sender)}</span>
                  {staff &&
                    (m.sms_ok === true ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                        נשלח ב-SMS
                      </span>
                    ) : m.sms_ok === false ? (
                      <>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                          SMS לא נשלח
                        </span>
                        {editable && (
                          <button
                            type="button"
                            className="font-medium text-brand-600 hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => run(resendFaultMessage(m.id, fault.fault_number))}
                          >
                            שלח שוב
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                        בשליחה…
                      </span>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {editable && (
          <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
            הודעת SMS נשלחת אוטומטית לתושב עם כל שינוי סטטוס של הקריאה.
          </p>
        )}
      </div>

      {/* Cost (staff only) */}
      {staff && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">עלויות</h2>
            <span className="text-sm text-gray-600">
              סה״כ: <span className="font-semibold text-gray-900">{shekels(fault.total_cost)}</span>
            </span>
          </div>

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
            {costItems.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-gray-500">לא נוספו פריטי עלות.</li>
            )}
            {costItems.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="text-gray-800">{c.description}</span>
                <span className="flex items-center gap-3">
                  <span className="font-medium tabular-nums" dir="ltr">{shekels(c.amount)}</span>
                  {editable && (
                    <button className="text-red-600 hover:underline" disabled={busy} onClick={() => run(deleteCostItem(c.id, fault.fault_number))}>
                      הסר
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {editable && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <label className="label">תיאור</label>
                <input className="field" placeholder="לדוגמה: ברז חדש" value={costDesc} onChange={(e) => setCostDesc(e.target.value)} />
              </div>
              <div className="w-28">
                <label className="label">סכום (₪)</label>
                <input className="field" type="number" min="0" step="0.01" dir="ltr" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} />
              </div>
              <button className="btn-secondary" disabled={busy || !costDesc.trim() || !costAmount.trim()} onClick={addCost}>
                הוספה
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-500">{label}:</dt>
      <dd className="text-gray-800" dir={ltr ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
