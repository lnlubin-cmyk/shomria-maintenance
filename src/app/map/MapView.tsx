"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GovMap, { drawHouses, zoomTo, type HousePoint } from "@/components/GovMap";
import { buildingLabel, type Building } from "@/lib/types";
import { wazeUrl, googleMapsUrl } from "@/lib/navigate";

function address(b: Building): string {
  return b.street_name ? `${b.street_name} ${b.house_number ?? ""}`.trim() : "";
}

export default function MapView({
  buildings,
  focusPlot,
}: {
  buildings: Building[];
  focusPlot: string | null;
}) {
  const layerNames = useMemo(() => {
    const s = new Set<string>();
    buildings.forEach((b) => b.layer?.name && s.add(b.layer.name));
    return [...s];
  }, [buildings]);

  const [active, setActive] = useState<Set<string>>(() => new Set(layerNames));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Building | null>(null);
  const readyRef = useRef(false);

  const visible = useMemo(
    () => buildings.filter((b) => b.layer?.name && active.has(b.layer.name)),
    [buildings, active]
  );

  const listed = useMemo(() => {
    const q = query.trim();
    if (!q) return visible;
    return visible.filter(
      (b) =>
        buildingLabel(b).includes(q) ||
        b.building_name.includes(q) ||
        (b.street_name ?? "").includes(q)
    );
  }, [visible, query]);

  function redraw(list: Building[]) {
    const pts: HousePoint[] = list
      .filter((b) => b.itm_x != null && b.itm_y != null)
      .map((b) => ({ itm_x: b.itm_x as number, itm_y: b.itm_y as number, label: b.building_name }));
    drawHouses(pts);
  }

  function select(b: Building) {
    setSelected(b);
    if (b.itm_x != null && b.itm_y != null) zoomTo(b.itm_x, b.itm_y, 10);
  }

  function onReady() {
    readyRef.current = true;
    redraw(visible);
    if (focusPlot) {
      const b = buildings.find((x) => x.plot_number === focusPlot);
      if (b) select(b);
    }
  }

  function onMapClick(x: number, y: number) {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of visible) {
      if (b.itm_x == null || b.itm_y == null) continue;
      const d = Math.hypot(b.itm_x - x, b.itm_y - y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best && bestD <= 40) setSelected(best);
  }

  // Redraw when the visible set changes (layer toggle), once the map is ready.
  useEffect(() => {
    if (readyRef.current) redraw(visible);
  }, [visible]);

  function toggleLayer(name: string) {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  if (buildings.length === 0) {
    return (
      <div className="card text-center text-gray-600">
        עדיין לא הוגדרו מיקומי בתים על המפה. אדמין יכול להוסיף מיקומים דרך „ניהול מערכת → מפה”.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <input
          className="field"
          placeholder="חיפוש לפי שם משפחה / מבנה"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {layerNames.length > 1 && (
          <div className="flex flex-wrap gap-4">
            {layerNames.map((n) => (
              <label key={n} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={active.has(n)}
                  onChange={() => toggleLayer(n)}
                />
                {n}
              </label>
            ))}
          </div>
        )}

        {selected && (
          <div className="card space-y-2">
            <div className="font-semibold">{buildingLabel(selected)}</div>
            {address(selected) && <div className="text-sm text-gray-600">{address(selected)}</div>}
            {selected.latitude != null && selected.longitude != null ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={wazeUrl(selected.latitude, selected.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  ניווט ב-Waze
                </a>
                <a
                  href={googleMapsUrl(selected.latitude, selected.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  Google Maps
                </a>
              </div>
            ) : (
              <div className="text-sm text-gray-500">אין קואורדינטות לניווט.</div>
            )}
          </div>
        )}

        <ul className="max-h-[360px] divide-y divide-gray-100 overflow-auto rounded-xl border border-gray-200 bg-white">
          {listed.length === 0 && (
            <li className="px-3 py-3 text-sm text-gray-500">לא נמצאו בתים.</li>
          )}
          {listed.map((b) => (
            <li key={b.plot_number}>
              <button
                type="button"
                onClick={() => select(b)}
                className={`block w-full px-3 py-2 text-right text-sm hover:bg-brand-50 ${
                  selected?.plot_number === b.plot_number ? "bg-brand-50 font-medium" : ""
                }`}
              >
                {buildingLabel(b)}
                {address(b) && <span className="text-gray-500"> · {address(b)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <GovMap level={9} onReady={onReady} onMapClick={onMapClick} height={620} />
    </div>
  );
}
