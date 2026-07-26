"use client";

import { useMemo, useState } from "react";
import { formatIsraeliPhone } from "@/lib/phone";

export interface DirectoryEntry {
  first_name: string;
  last_name: string;
  phone: string;
}

export default function PhoneDirectory({ residents }: { residents: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q));
  }, [residents, query]);

  return (
    <div>
      <input
        className="field"
        placeholder="חיפוש לפי שם משפחה או שם פרטי"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {residents.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">
            אין כרגע תושבים שאישרו לשתף את מספר הטלפון.
          </li>
        )}
        {residents.length > 0 && results.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">לא נמצאו תוצאות.</li>
        )}
        {results.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className="text-gray-800">
              {r.first_name} {r.last_name}
            </span>
            <a
              href={`tel:${r.phone}`}
              dir="ltr"
              className="font-medium text-brand-600 hover:underline"
            >
              {formatIsraeliPhone(r.phone)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
