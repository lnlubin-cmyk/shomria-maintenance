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

  // Labels declutter: shown only when the visible map is narrower than this
  // (meters east–west). Tunable once calibrated in-browser.
  const LABEL_MAX_WIDTH_M = 700;

  const [active, setActive] = useState<Set<string>>(() => new Set(layerNames));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Building | null>(null);
  const [labelsHidden, setLabelsHidden] = useState(false);
  const [viewWidth, setViewWidth] = useState<number | null>(null); // shown for calibration
  const [debug, setDebug] = useState<string[]>([]);
  const readyRef = useRef(false);
  const showLabelsRef = useRef(true);

  const visible = useMemo(
    () => buildings.filter((b) => b.layer?.name && active.has(b.layer.name)),
    [buildings, active]
  );
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

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

  function redraw() {
    const pts: HousePoint[] = visibleRef.current
      .filter((b) => b.itm_x != null && b.itm_y != null)
      .map((b) => ({ itm_x: b.itm_x as number, itm_y: b.itm_y as number, label: b.building_name }));
    drawHouses(pts, { showLabels: showLabelsRef.current });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onExtent(payload: any) {
    // Pull [xmin, ymin, xmax, ymax] (ITM meters) from whatever shape govmap
    // sends. The raw payload is also logged (debug box) for calibration.
    let xmin: unknown, xmax: unknown;
    const p = payload;
    if (Array.isArray(p) && p.length >= 4) {
      xmin = p[0];
      xmax = p[2];
    } else if (p && typeof p === "object") {
      const e = p.extent ?? p.mapExtent ?? p.newExtent ?? p;
      if (Array.isArray(e) && e.length >= 4) {
        xmin = e[0];
        xmax = e[2];
      } else if (e && typeof e === "object") {
        xmin = e.xmin ?? e.xMin ?? e.minx ?? e.left ?? e.west;
        xmax = e.xmax ?? e.xMax ?? e.maxx ?? e.right ?? e.east;
      }
    }
    if (typeof xmin !== "number" || typeof xmax !== "number") return;

    const widthM = Math.abs(xmax - xmin);
    setViewWidth(widthM);
    const show = widthM <= LABEL_MAX_WIDTH_M;
    if (show !== showLabelsRef.current) {
      showLabelsRef.current = show;
      setLabelsHidden(!show);
      if (readyRef.current) redraw();
    }
  }

  function select(b: Building) {
    setSelected(b);
    if (b.itm_x != null && b.itm_y != null) zoomTo(b.itm_x, b.itm_y, 10);
  }

  function onReady() {
    readyRef.current = true;
    redraw();
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
    if (readyRef.current) redraw();
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

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Temporary readout for calibrating the label width threshold. */}
          <span className="rounded-lg bg-gray-100 px-2 py-1 text-gray-600" dir="ltr">
            width: {viewWidth != null ? Math.round(viewWidth) + "m" : "—"}
          </span>
          {labelsHidden && (
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-blue-800">
              התקרב במפה כדי לראות את שמות הבתים.
            </span>
          )}
        </div>
        {debug.length > 0 && (
          <pre
            className="mb-2 max-h-32 overflow-auto rounded-lg bg-gray-900 p-2 text-[11px] text-gray-100"
            dir="ltr"
          >
            {debug.join("\n")}
          </pre>
        )}
        <GovMap
          level={9}
          onReady={onReady}
          onMapClick={onMapClick}
          onExtent={onExtent}
          onDebug={(m) => setDebug((d) => [...d.slice(-14), m])}
          height={620}
        />
      </div>
    </div>
  );
}
