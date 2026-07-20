"use client";

import { useEffect, useRef, useState } from "react";
import { buildingLabel, type Building } from "@/lib/types";

/** "בית משפחת לוי — הגפן 1" — prefixed name plus street address. */
function buildingOption(b: Building): string {
  const addr = b.street_name ? ` — ${b.street_name} ${b.house_number ?? ""}`.trimEnd() : "";
  return `${buildingLabel(b)}${addr}`;
}

/**
 * שם המבנה picker. A searchable dropdown over the in-memory buildings list —
 * type to filter, click to select. The field holds a plot_number or nothing, so
 * free text is never submitted as a building.
 *
 * Selection uses onMouseDown + preventDefault so the pick registers before the
 * input loses focus — the native <select> this replaced was easy to mis-click.
 */
export default function BuildingPicker({
  buildings,
  value,
  onChange,
  disabled,
}: {
  buildings: Building[];
  value: string;
  onChange: (plotNumber: string, label: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(() => {
    const b = buildings.find((x) => x.plot_number === value);
    return b ? buildingOption(b) : "";
  });
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = query.trim();
  // While a building is selected, focusing shows the whole list again so the
  // user can rebrowse; typing (which clears value) narrows it.
  const filtered = q && !value ? buildings.filter((b) => buildingOption(b).includes(q)) : buildings;

  function select(b: Building) {
    const label = buildingOption(b);
    setQuery(label);
    onChange(b.plot_number, label);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className="field"
        value={query}
        disabled={disabled}
        placeholder="חיפוש לפי שם המבנה"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("", e.target.value); // typing invalidates the selection
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

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו מבנים בשם זה</li>
          )}
          {filtered.map((b) => (
            <li key={b.plot_number}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-right text-sm hover:bg-brand-50"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus; register before blur
                  select(b);
                }}
              >
                {buildingOption(b)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
