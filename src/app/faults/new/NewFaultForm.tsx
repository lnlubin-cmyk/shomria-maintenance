"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResidentPicker from "@/components/ResidentPicker";
import BuildingPicker from "@/components/BuildingPicker";
import { createFault } from "../actions";
import type { Building } from "@/lib/types";

export default function NewFaultForm({
  buildings,
  defaultBuildingPlot,
  currentResidentId,
  currentResidentName,
}: {
  buildings: Building[];
  defaultBuildingPlot: string | null;
  currentResidentId: string | null;
  currentResidentName: string;
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
          <label className="label">סטטוס תקלה</label>
          <input className="field" value="פתיחת תקלה" disabled readOnly />
        </div>
      </div>

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
