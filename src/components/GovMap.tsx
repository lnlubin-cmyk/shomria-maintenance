"use client";

import { useEffect, useRef, useState } from "react";
import { splitHouseLabel } from "@/lib/types";

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
export function drawHouses(points: HousePoint[], opts: { showLabels?: boolean } = {}) {
  const { showLabels = true } = opts;
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
      // Surname on the first row, first names (if any) on a second row.
      labels: points.map((p) => splitHouseLabel(p.label).join("\n")),
      defaultSymbol: { url: TRANSPARENT_PIN, width: 1, height: 1 },
      fontLabel: { fontName: "Arial", fontSize: 16, fillColor: "#14532d" },
    });
  } else {
    // Zoomed out: show nothing at all — no labels and no markers. Clearing the
    // existing geometries with an empty set leaves a clean map.
    g.displayGeometries({
      wkts: [],
      names: [],
      geometryType: g.geometryType.POINT,
      clearExisting: true,
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
  const [ready, setReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [expanded, setExpanded] = useState(false); // CSS fallback when the API is unavailable

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
            if (!cancelled) setReady(true);
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

  // Nudge the map to re-lay-out when its size changes (govmap doesn't always
  // auto-resize when its container grows/shrinks).
  const nudgeResize = () => {
    for (const t of [60, 300]) window.setTimeout(() => window.dispatchEvent(new Event("resize")), t);
  };

  useEffect(() => {
    const onFs = () => {
      setNativeFs(!!document.fullscreenElement);
      nudgeResize();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Esc exits the CSS fallback (native fullscreen exits on its own).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
        nudgeResize();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  async function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
      return;
    }
    if (expanded) {
      setExpanded(false);
      nudgeResize();
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* fall through to the CSS fallback */
      }
    }
    setExpanded(true);
    nudgeResize();
  }

  const isOpen = nativeFs || expanded;

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      <div
        ref={wrapRef}
        className={`relative w-full overflow-hidden border border-gray-200 ${
          expanded ? "fixed inset-0 z-[60] rounded-none bg-white" : "rounded-xl"
        }`}
        style={{ height: isOpen ? "100vh" : height }}
      >
        <div id="govmap" className="h-full w-full" />
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 text-gray-500">
            <svg className="h-8 w-8 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
            <span className="text-sm">טוען מפה…</span>
          </div>
        )}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H4m5 0V4m6 5h5m-5 0V4m0 16v-5m0 5h5m-11 0v-5m0 5H4" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
          {isOpen ? "יציאה ממסך מלא" : "מסך מלא"}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">שים לב: תצוגת מסך מלא אינה נתמכת בכל המכשירים.</p>
    </div>
  );
}
