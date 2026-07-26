"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function HalachicTab({ years }: { years: { year: number; days: number }[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/import-halachic", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "טעינת הקובץ נכשלה");
        return;
      }
      setSuccess(`נטען לוח זמנים לשנת ${data.year} — ${data.months} חודשים, ${data.days} ימים.`);
      router.refresh();
    } catch {
      setError("שגיאת רשת. נסה שוב.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>
      )}

      <div className="card">
        <h2 className="font-semibold">טעינת לוח זמנים הלכתיים (Excel)</h2>
        <p className="mt-1 text-sm text-gray-600">
          קובץ עם לשונית לכל חודש עברי (בשנה מעוברת: „אדר א” ו„אדר ב”). הזמנים נטענים לפי התאריך העברי,
          והדף מציג את זמני היום הנוכחי. טעינה מחדש של אותה שנה תעדכן את הנתונים.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            disabled={busy}
            className="block w-full text-sm file:ml-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-600"
          />
          {busy && <span className="whitespace-nowrap text-sm text-gray-600">טוען...</span>}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-2 font-semibold">שנים שנטענו</h3>
        {years.length === 0 ? (
          <p className="text-sm text-gray-500">עדיין לא נטען לוח זמנים.</p>
        ) : (
          <ul className="text-sm text-gray-700">
            {years.map((y) => (
              <li key={y.year} className="flex justify-between border-b border-gray-100 py-1.5">
                <span>שנת {y.year}</span>
                <span className="text-gray-500">{y.days} ימים</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
