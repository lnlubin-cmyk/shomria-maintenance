"use client";

import { useRef, useState } from "react";
import type { BuildingLayer } from "@/lib/types";

interface RowError {
  row: number;
  message: string;
}

/** Excel upload of houses: house name + layer, residents optional. */
export default function ImportBuildings({
  layers,
  onImported,
}: {
  layers: BuildingLayer[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setErrors([]);
    setSuccess(null);

    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/admin/import-buildings", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "טעינת הקובץ נכשלה");
        setErrors(data.errors ?? []);
        return;
      }

      setSuccess(`נטענו ${data.imported} מבנים בהצלחה. מספר המגרש הוקצה אוטומטית לכל מבנה.`);
      onImported();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card">
      <h2 className="font-semibold">טעינת מבנים מקובץ Excel</h2>
      <p className="mt-1 text-sm text-gray-600">
        העמודות בקובץ חייבות להיות בסדר הבא: שם המבנה, שכבה, ולאחריהן עד 4 תעודות זהות של תושבים
        (אופציונלי). שם המבנה והשכבה חובה; התושבים אינם חובה. שורת כותרת תזוהה ותדולג אוטומטית.
      </p>
      <p className="mt-1 text-sm text-gray-600">
        שכבות אפשריות: {layers.map((l) => `„${l.name}”`).join(", ")}. ניתן לכתוב את שם השכבה או את
        המספר שלה.
      </p>
      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        מספר המגרש מוקצה אוטומטית על ידי המערכת. כל טעינה <b>מוסיפה</b> מבנים חדשים — טעינה חוזרת של
        אותו קובץ תיצור מבנים כפולים.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFile}
          disabled={busy}
          className="block w-full text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
        />
        {busy && <span className="whitespace-nowrap text-sm text-gray-600">טוען...</span>}
      </div>

      {success && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-medium">{error}</p>
          {errors.length > 0 && (
            <ul className="mt-2 max-h-48 list-inside list-disc overflow-auto">
              {errors.map((err, i) => (
                <li key={i}>{err.row > 0 ? `שורה ${err.row}: ` : ""}{err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
