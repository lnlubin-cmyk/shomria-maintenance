"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GovMap, { drawHouses, zoomTo, type HousePoint } from "@/components/GovMap";
import { buildingLabel, type Building } from "@/lib/types";
import { saveBuildingLocation, clearBuildingLocation } from "./actions";

/**
 * Admin house placement. Pick a building, then click its spot on the map — the
 * ITM click is converted to WGS84 and both are stored. Placed buildings show as
 * markers; unplaced ones are listed for placement.
 */
export default function BuildingsMapTab({ buildings }: { buildings: Building[] }) {
  const router = useRouter();
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState<null | "pdf" | "png">(null);
  const readyRef = useRef(false);

  const placed = useMemo(() => buildings.filter((b) => b.itm_x != null && b.itm_y != null), [buildings]);
  const unplaced = useMemo(() => buildings.filter((b) => b.itm_x == null), [buildings]);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedPlot;

  function redraw() {
    const pts: HousePoint[] = placed.map((b) => ({
      itm_x: b.itm_x as number,
      itm_y: b.itm_y as number,
      label: b.building_name,
    }));
    drawHouses(pts);
  }

  function onReady() {
    readyRef.current = true;
    redraw();
  }

  useEffect(() => {
    if (readyRef.current) redraw();
  }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onMapClick(x: number, y: number) {
    const plot = selectedRef.current;
    if (!plot) {
      setError("בחר מבנה מהרשימה לפני לחיצה על המפה.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await saveBuildingLocation(plot, x, y);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSelectedPlot(null);
    router.refresh();
  }

  async function unplace(plot: string) {
    if (!confirm("להסיר את מיקום המבנה מהמפה?")) return;
    setBusy(true);
    const result = await clearBuildingLocation(plot);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  function focusPlaced(b: Building) {
    if (b.itm_x != null && b.itm_y != null) zoomTo(b.itm_x, b.itm_y, 10);
  }

  async function downloadSecurityMap(format: "pdf" | "png") {
    setError(null);
    setGenBusy(format);
    try {
      const res = await fetch(`/api/admin/security-map${format === "png" ? "?format=png" : ""}`);
      if (!res.ok) {
        setError("יצירת מפת הביטחון נכשלה. נסה שוב.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shomria-security-map-A3.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("שגיאת רשת ביצירת המפה.");
    } finally {
      setGenBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 border-brown-100 bg-brown-50/40">
        <div>
          <h2 className="font-semibold text-gray-900">מפת ביטחון (A3)</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            מפה עם צילום אוויר וכל שמות הבתים, כולל כיווני צפון/דרום/מזרח/מערב. כוללת את כל הבתים
            שמוקמו ({placed.length}). ה-PDF להדפסה; ה-PNG לעריכה ידנית (למשל הוספת בתים חדשים)
            בתוכנת „צייר” (Paint). היצירה עשויה לקחת מספר שניות.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            onClick={() => downloadSecurityMap("pdf")}
            disabled={genBusy !== null || placed.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {genBusy === "pdf" ? "יוצר מפה…" : "הורדת מפה (PDF)"}
          </button>
          <button
            type="button"
            onClick={() => downloadSecurityMap("png")}
            disabled={genBusy !== null || placed.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            {genBusy === "png" ? "יוצר תמונה…" : "הורדת מפה לעריכה (PNG)"}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
        {selectedPlot ? (
          <>
            נבחר <strong>{buildingLabel(buildings.find((b) => b.plot_number === selectedPlot))}</strong> —
            לחץ על מיקומו במפה כדי לשמור. {busy && "שומר..."}
          </>
        ) : (
          "בחר מבנה מרשימת „ללא מיקום”, ואז לחץ על מיקומו במפה."
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
              ללא מיקום ({unplaced.length})
            </div>
            <ul className="max-h-56 divide-y divide-gray-100 overflow-auto rounded-xl border border-gray-200 bg-white">
              {unplaced.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">כל המבנים מוקמו.</li>
              )}
              {unplaced.map((b) => (
                <li key={b.plot_number}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlot(b.plot_number)}
                    className={`block w-full px-3 py-2 text-right text-sm hover:bg-brand-50 ${
                      selectedPlot === b.plot_number ? "bg-brand-100 font-medium" : ""
                    }`}
                  >
                    {buildingLabel(b)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
              מוקמו ({placed.length})
            </div>
            <ul className="max-h-56 divide-y divide-gray-100 overflow-auto rounded-xl border border-gray-200 bg-white">
              {placed.length === 0 && (
                <li className="px-3 py-2 text-sm text-gray-500">אין מבנים מוקמים.</li>
              )}
              {placed.map((b) => (
                <li key={b.plot_number} className="flex items-center justify-between px-3 py-2 text-sm">
                  <button
                    type="button"
                    className="text-right hover:text-brand-700"
                    onClick={() => focusPlaced(b)}
                  >
                    {buildingLabel(b)}
                  </button>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-brand-600 hover:underline"
                      onClick={() => setSelectedPlot(b.plot_number)}
                    >
                      מקם מחדש
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => unplace(b.plot_number)}
                    >
                      הסר
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <GovMap level={9} onReady={onReady} onMapClick={onMapClick} height={620} />
      </div>
    </div>
  );
}
