"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared govmap canvas. Loads the govmap SDK, creates a streets-and-buildings
 * map centered on the kibbutz, subscribes to map clicks, and signals when ready.
 * Callers then use the global `govmap` (via the helpers below) to draw markers
 * and zoom. Data always lives in our DB — govmap is only the canvas.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const govmap: any;

const SDK_URL = "https://www.govmap.gov.il/govmap/api/govmap.api.js";
const SDK_ID = "govmap-sdk";

// Kibbutz Shomria center in ITM (from 31.43223°N, 34.88374°E).
export const SHOMRIA_ITM = { x: 188967, y: 593407 };

// A small colored dot as a data URI, so markers show without a hosted image.
export function pinDataUri(fill: string): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="6" fill="${fill}" stroke="#fff" stroke-width="2"/></svg>`
    )
  );
}

export interface HousePoint {
  itm_x: number;
  itm_y: number;
  label: string;
}

/** Draw the given houses as labeled markers (replaces whatever was drawn). */
export function drawHouses(points: HousePoint[], fill = "#2f7d5d") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).govmap;
  if (!g) return;
  g.displayGeometries({
    wkts: points.map((p) => `POINT(${p.itm_x} ${p.itm_y})`),
    names: points.map((p) => p.label),
    labels: points.map((p) => p.label),
    geometryType: g.geometryType.POINT,
    defaultSymbol: { url: pinDataUri(fill), width: 16, height: 16 },
    clearExisting: true,
    // Crisp dark label, no heavy white halo (the base map is light).
    fontLabel: { fontName: "Arial", fontSize: 14, fillColor: "#14532d" },
  });
}

/** Center + zoom the map on a coordinate, dropping govmap's own highlight marker. */
export function zoomTo(itmX: number, itmY: number, level = 10) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).govmap;
  if (!g) return;
  g.zoomToXY({ x: itmX, y: itmY, level, marker: true });
}

export default function GovMap({
  level = 9,
  onReady,
  onMapClick,
  height = 560,
}: {
  level?: number;
  onReady?: () => void;
  onMapClick?: (itmX: number, itmY: number) => void;
  height?: number;
}) {
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function createMap() {
      if (cancelled || typeof govmap === "undefined") return;
      try {
        govmap.createMap("govmap", {
          token: process.env.NEXT_PUBLIC_GOVMAP_TOKEN,
          background: "0", // רחובות ומבנים
          level,
          center: SHOMRIA_ITM,
          onLoad: () => {
            try {
              govmap
                .onEvent(govmap.events.CLICK)
                .progress((e: { mapPoint?: { x: number; y: number } }) => {
                  const mp = e?.mapPoint;
                  if (mp && typeof mp.x === "number") clickRef.current?.(mp.x, mp.y);
                });
            } catch {
              /* clicks optional */
            }
            readyRef.current?.();
          },
        });
      } catch (e) {
        setError(`טעינת המפה נכשלה: ${(e as Error).message}`);
      }
    }

    // The SDK sets a global. On client-side navigation the script is already
    // loaded, so next/script's onLoad would never fire — load it ourselves and
    // create the map whether the SDK is already present or loads now.
    if (typeof govmap !== "undefined") {
      createMap();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SDK_ID;
      script.src = SDK_URL;
      script.async = true;
      document.body.appendChild(script);
    }
    const onLoad = () => createMap();
    const onErr = () => setError("טעינת סקריפט govmap נכשלה (בדוק חיבור לרשת).");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onErr);

    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onErr);
    };
    // level is stable for a given mount; callbacks go through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      <div
        id="govmap"
        className="w-full overflow-hidden rounded-xl border border-gray-200"
        style={{ height }}
      />
    </div>
  );
}
