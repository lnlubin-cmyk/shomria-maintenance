"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Resident } from "@/lib/types";

/**
 * Searchable resident picker for the building form. The admin searches by first
 * name, last name, or ת"ז (the ID disambiguates two residents with the same
 * name), sees the name in the box, and the form submits the resident's ID via a
 * hidden input — so the server action stores the ID, not the name.
 */
export default function ResidentPicker({
  name,
  label,
  residents,
  defaultValue,
}: {
  name: string;
  label: string;
  residents: Resident[];
  defaultValue?: string | null;
}) {
  const byId = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents]);
  const nameOf = (id: string) => {
    const r = id ? byId.get(id) : null;
    return r ? `${r.first_name} ${r.last_name}` : "";
  };

  const [selected, setSelected] = useState(defaultValue ?? "");
  const [query, setQuery] = useState(nameOf(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Close on outside click, and restore the box to the committed selection.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(nameOf(selectedRef.current));
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // byId is stable for a given residents list; nameOf closes over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? residents.filter((r) => {
          const full = `${r.first_name} ${r.last_name}`.toLowerCase();
          return full.includes(q) || r.id.includes(q);
        })
      : residents;
    return base.slice(0, 50);
  }, [residents, query]);

  function choose(r: Resident | null) {
    if (r) {
      setSelected(r.id);
      setQuery(`${r.first_name} ${r.last_name}`);
    } else {
      setSelected("");
      setQuery("");
    }
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={selected} />
      <input
        className="field"
        placeholder="שם או ת.ז."
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected("");
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <li>
            <button
              type="button"
              onClick={() => choose(null)}
              className="block w-full px-3 py-1.5 text-right text-sm text-gray-500 hover:bg-gray-50"
            >
              — ללא —
            </button>
          </li>
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => choose(r)}
                className={`block w-full px-3 py-1.5 text-right text-sm hover:bg-brand-50 ${
                  selected === r.id ? "bg-brand-50 font-medium" : ""
                }`}
              >
                {r.first_name} {r.last_name}
                <span className="text-gray-400" dir="ltr"> · {r.id}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו תושבים.</li>
          )}
        </ul>
      )}
    </div>
  );
}
