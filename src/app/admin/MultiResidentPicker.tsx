"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { Resident } from "@/lib/types";

/**
 * Multi-select resident picker: search by name or ת"ז, add residents as removable
 * chips, capped at `max`. State is owned by the parent (value / onChange) so the
 * same picker serves both the committee and the election candidate slate.
 */
export default function MultiResidentPicker({
  residents,
  value,
  onChange,
  max,
  placeholder = "שם או ת.ז.",
}: {
  residents: Resident[];
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  placeholder?: string;
}) {
  const byId = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const atCap = value.length >= max;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = residents.filter((r) => {
      if (value.includes(r.id)) return false;
      if (!q) return true;
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || r.id.includes(q);
    });
    return base.slice(0, 30);
  }, [residents, query, value]);

  function add(id: string) {
    if (atCap || value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
  }
  function remove(id: string) {
    onChange(value.filter((x) => x !== id));
  }

  return (
    <div ref={wrapRef} className="relative">
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => {
            const r = byId.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-sm text-brand-800"
              >
                {r ? `${r.first_name} ${r.last_name}` : id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-brand-500 hover:text-brand-800"
                  aria-label="הסרה"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      <input
        className="field"
        placeholder={atCap ? `הגעת למקסימום (${max})` : placeholder}
        value={query}
        disabled={atCap}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && !atCap && query.trim() !== "" && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => add(r.id)}
                className="block w-full px-3 py-1.5 text-right text-sm hover:bg-brand-50"
              >
                {r.first_name} {r.last_name}
                <span className="text-gray-400" dir="ltr">
                  {" "}
                  · {r.id}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו תושבים.</li>
          )}
        </ul>
      )}
      <p className="mt-1 text-xs text-gray-400">
        נבחרו {value.length} מתוך {max} לכל היותר.
      </p>
    </div>
  );
}
