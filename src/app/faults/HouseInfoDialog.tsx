"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { addBuildingFact, deleteBuildingFact, fetchBuildingFacts, updateWaterHeaterType } from "./actions";
import type { BuildingFact } from "@/lib/types";

export interface HouseOption {
  plot_number: string;
  label: string;
}

/**
 * Add useful [key, value] info to a house. Staff pick the house by name or by ID
 * (the info is always stored against the house ID), see what's already saved, and
 * add or remove entries.
 */
export default function HouseInfoDialog({
  buildings,
  onClose,
}: {
  buildings: HouseOption[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HouseOption | null>(null);
  const [facts, setFacts] = useState<BuildingFact[]>([]);
  const [factKey, setFactKey] = useState("");
  const [factValue, setFactValue] = useState("");
  const [waterHeater, setWaterHeater] = useState("");
  const [whSaved, setWhSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? buildings.filter(
          (b) => b.label.toLowerCase().includes(q) || b.plot_number.toLowerCase().includes(q)
        )
      : buildings;
    return base.slice(0, 30);
  }, [buildings, query]);

  async function loadFacts(plot: string) {
    setWhSaved(false);
    const res = await fetchBuildingFacts(plot);
    if ("error" in res) {
      setError(res.error);
      setFacts([]);
      setWaterHeater("");
    } else {
      setFacts(res.facts);
      setWaterHeater(res.waterHeater ?? "");
    }
  }

  async function saveWaterHeater() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    const res = await updateWaterHeaterType(selected.plot_number, waterHeater);
    if ("error" in res) setError(res.error);
    else setWhSaved(true);
    setBusy(false);
  }

  async function choose(b: HouseOption) {
    setSelected(b);
    setQuery(`${b.label} · ${b.plot_number}`);
    setOpen(false);
    setError(null);
    setBusy(true);
    await loadFacts(b.plot_number);
    setBusy(false);
  }

  async function add() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    const res = await addBuildingFact(selected.plot_number, factKey, factValue);
    if ("error" in res) {
      setError(res.error);
    } else {
      setFactKey("");
      setFactValue("");
      await loadFacts(selected.plot_number);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!selected) return;
    setError(null);
    setBusy(true);
    const res = await deleteBuildingFact(id, selected.plot_number);
    if ("error" in res) setError(res.error);
    else await loadFacts(selected.plot_number);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">מידע שימושי על בית</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="סגירה">
            ✕
          </button>
        </div>

        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {/* House picker */}
        <div className="relative" ref={searchRef}>
          <label className="label">בחירת בית (לפי שם או מספר בית)</label>
          <input
            className="field"
            placeholder="שם המבנה או מספר הבית"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setFacts([]);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
              {matches.map((b) => (
                <li key={b.plot_number}>
                  <button
                    type="button"
                    onClick={() => choose(b)}
                    className="block w-full px-3 py-1.5 text-right text-sm hover:bg-brand-50"
                  >
                    {b.label}
                    <span className="text-gray-400" dir="ltr">
                      {" "}
                      · {b.plot_number}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">לא נמצאו בתים.</li>
              )}
            </ul>
          )}
        </div>

        {selected && (
          <div className="mt-5 space-y-4">
            {/* סוג הדוד — the one building field maintenance staff may edit. */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <label className="label">סוג הדוד</label>
              <div className="flex items-end gap-2">
                <input
                  className="field flex-1"
                  placeholder="לדוגמה: דוד שמש"
                  value={waterHeater}
                  onChange={(e) => {
                    setWaterHeater(e.target.value);
                    setWhSaved(false);
                  }}
                />
                <button className="btn-secondary" disabled={busy} onClick={saveWaterHeater}>
                  שמירה
                </button>
              </div>
              {whSaved && <p className="mt-1 text-xs text-emerald-700">סוג הדוד נשמר.</p>}
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
                  <button
                    className="shrink-0 text-red-600 hover:underline"
                    disabled={busy}
                    onClick={() => remove(f.id)}
                  >
                    הסר
                  </button>
                </li>
              ))}
            </ul>

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
              <button className="btn-primary" disabled={busy || !factKey.trim()} onClick={add}>
                הוספה
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            סגירה
          </button>
        </div>
      </div>
    </div>
  );
}
