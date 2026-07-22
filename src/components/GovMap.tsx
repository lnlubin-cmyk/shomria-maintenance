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

// A colored dot as a data URI, so markers show without a hosted image. The SVG's
// intrinsic size matches `size` so govmap doesn't scale it (scaling a mismatched
// SVG made the dot render wrong/invisible).
export function pinDataUri(fill: string, size = 18): string {
  const c = size / 2;
  const r = c - 2;
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${c}" cy="${c}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="2"/></svg>`
    )
  );
}

// A 1×1 transparent symbol — used when we want the label alone, with no dot
// overlapping the text.
const TRANSPARENT_PIN =
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`);

export interface HousePoint {
  itm_x: number;
  itm_y: number;
  label: string;
}

/**
 * Draw the given houses as markers (replaces whatever was drawn). Labels can be
 * suppressed (dots only) — used to declutter when zoomed out.
 */
export function drawHouses(
  points: HousePoint[],
  opts: { fill?: string; showLabels?: boolean } = {}
) {
  const { fill = "#2f7d5d", showLabels = true } = opts;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).govmap;
  if (!g) return;

  const common = {
    wkts: points.map((p) => `POINT(${p.itm_x} ${p.itm_y})`),
    names: points.map((p) => p.label),
    geometryType: g.geometryType.POINT,
    clearExisting: true,
  };

  if (showLabels) {
    // Text-only when zoomed in: a transparent symbol so the label stands alone
    // (a dot would sit on top of the text and muddy it).
    g.displayGeometries({
      ...common,
      labels: points.map((p) => p.label),
      defaultSymbol: { url: TRANSPARENT_PIN, width: 1, height: 1 },
      fontLabel: { fontName: "Arial", fontSize: 16, fillColor: "#14532d" },
    });
  } else {
    // Dots-only when zoomed out for a clean overview. Do NOT pass `labels` —
    // govmap drops a geometry whose label is an empty string, so empty labels
    // would render nothing at all (the bug that hid the dots).
    const S = 14;
    g.displayGeometries({
      ...common,
      defaultSymbol: { url: pinDataUri(fill, S), width: S, height: S },
    });
  }
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
  onExtent,
  height = 560,
}: {
  level?: number;
  onReady?: () => void;
  onMapClick?: (itmX: number, itmY: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onExtent?: (payload: any) => void;
  height?: number;
}) {
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;
  const extentRef = useRef(onExtent);
  extentRef.current = onExtent;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function createMap() {
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
            // The token is domain-locked to production, so the authenticated
            // getZoomLevel API returns 401 on localhost. Instead read the view
            // extent from the EXTENT_CHANGE event payload (no auth needed) and
            // let the caller decide when to hide labels.
            try {
              govmap
                .onEvent(govmap.events.EXTENT_CHANGE)
                .progress((arg: unknown) => extentRef.current?.(arg));
            } catch {
              /* extent events optional */
            }
            readyRef.current?.();
          },
        });
      } catch (e) {
        setError(`טעינת המפה נכשלה: ${(e as Error).message}`);
      }
    }

    // The SDK sets the `govmap` global before createMap is actually attached,
    // and next/script's onLoad doesn't fire on client-side navigation. So load
    // the script if needed and poll until createMap is genuinely available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const isReady = () => w.govmap && typeof w.govmap.createMap === "function";

    if (!isReady() && !document.getElementById(SDK_ID)) {
      const script = document.createElement("script");
      script.id = SDK_ID;
      script.src = SDK_URL;
      script.async = true;
      script.addEventListener("error", () =>
        setError("טעינת סקריפט govmap נכשלה (בדוק חיבור לרשת).")
      );
      document.body.appendChild(script);
    }

    let tries = 0;
    function whenReady() {
      if (cancelled) return;
      if (isReady()) {
        createMap();
        return;
      }
      if (tries++ > 200) {
        setError("המפה לא נטענה בזמן. רענן את הדף.");
        return;
      }
      window.setTimeout(whenReady, 50);
    }
    whenReady();

    return () => {
      cancelled = true;
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
