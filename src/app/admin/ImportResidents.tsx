"use client";

import { useRef, useState } from "react";

interface RowError {
  row: number;
  message: string;
}

/** Spec screen 4: Excel upload of residents, columns in a fixed order. */
export default function ImportResidents({ onImported }: { onImported: () => void }) {
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

      const res = await fetch("/api/admin/import-residents", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "טעינת הקובץ נכשלה");
        setErrors(data.errors ?? []);
        return;
      }

      setSuccess(`נטענו ${data.imported} תושבים בהצלחה.`);
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
      <h2 className="font-semibold">טעינת תושבים מקובץ Excel</h2>
      <p className="mt-1 text-sm text-gray-600">
        העמודות בקובץ חייבות להיות בסדר הבא: תעודת זהות, שם פרטי, שם משפחה, מספר טלפון. שורת כותרת
        תזוהה ותדולג אוטומטית. תושב עם תעודת זהות קיימת יעודכן.
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
                <li key={i}>
                  שורה {err.row}: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
