"use client";

import { useEffect, useRef, useState } from "react";
import type { Resident } from "@/lib/types";

type Option = Pick<Resident, "id" | "first_name" | "last_name">;

/**
 * שם הפונה picker. Free text is never accepted as a value — the field holds a
 * resident id or nothing, which is how "אין אפשרות להכניס שם שלא רשום במערכת"
 * is enforced in the UI. The server re-checks via the residents FK.
 */
export default function ResidentPicker({
  value,
  initialLabel,
  onChange,
  disabled,
}: {
  value: string | null;
  initialLabel: string;
  onChange: (id: string | null, label: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(initialLabel);
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/residents/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setOptions(data.residents ?? []);
      } catch {
        // Aborted or offline — leave the list as-is.
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  function select(o: Option) {
    const label = `${o.first_name} ${o.last_name}`;
    setQuery(label);
    onChange(o.id, label);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className="field"
        value={query}
        disabled={disabled}
        placeholder="חיפוש לפי שם פרטי או שם משפחה"
        onChange={(e) => {
          setQuery(e.target.value);
          // Typing invalidates the previous selection — the caller must pick a
          // real resident from the list again.
          onChange(null, e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />

      {value && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600">
          ✓ נבחר
        </span>
      )}

      {open && query.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">מחפש...</li>}
          {!loading && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו תושבים בשם זה</li>
          )}
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-right text-sm hover:bg-brand-50"
                // onMouseDown + preventDefault: register the pick before the
                // input's blur can close the list out from under the click.
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(o);
                }}
              >
                {o.first_name} {o.last_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
