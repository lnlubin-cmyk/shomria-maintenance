"use client";

import { useRef, useState } from "react";
import Script from "next/script";

/**
 * SPIKE — throwaway proof that govmap works with our token. Confirms in the
 * browser (can't be tested headlessly):
 *   1. the map renders with our token,
 *   2. a map click delivers an ITM coordinate (govmap.onEvent CLICK),
 *   3. govmap.displayGeometries() paints our own labeled markers client-side,
 *      with no govmap layer.
 *
 * Click anywhere on the map to drop a numbered marker. Once confirmed, this is
 * replaced by the real map view + admin placement.
 *
 * govmap works in ITM (EPSG:2039). Center below is approximate — pan to Shomria.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const govmap: any;

const SHOMRIA_ITM = { x: 187500, y: 588500 }; // approximate — adjust after we see it

// A small green dot as a data URI, so markers are visible without a hosted image.
const PIN =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="6" fill="#2f7d5d" stroke="#fff" stroke-width="2"/></svg>`
  );

type Pt = { x: number; y: number; label: string };

export default function MapSpike({ token }: { token: string }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ x: number; y: number } | null>(null);
  const [count, setCount] = useState(0);
  const ptsRef = useRef<Pt[]>([]);

  function redraw() {
    const pts = ptsRef.current;
    govmap.displayGeometries({
      wkts: pts.map((p) => `POINT(${p.x} ${p.y})`),
      names: pts.map((p) => p.label),
      labels: pts.map((p) => p.label),
      geometryType: govmap.geometryType.POINT,
      defaultSymbol: { url: PIN, width: 18, height: 18 },
      clearExisting: true,
      fontLabel: { fontName: "Arial", fontSize: 14, fillColor: "#1c4d38", strokeColor: "#ffffff" },
    });
  }

  // Stable via refs, so no stale closure when registered in onLoad.
  function handleClick(e: { mapPoint?: { x: number; y: number } }) {
    const mp = e?.mapPoint;
    if (!mp || typeof mp.x !== "number") return;
    const label = `בית ${ptsRef.current.length + 1}`;
    ptsRef.current = [...ptsRef.current, { x: mp.x, y: mp.y, label }];
    setLast({ x: mp.x, y: mp.y });
    setCount(ptsRef.current.length);
    redraw();
  }

  function initMap() {
    try {
      govmap.createMap("govmap", {
        token,
        // background "2" is usually the orthophoto (aerial). If the base map
        // isn't aerial, tell me and I'll switch the value.
        background: "2",
        level: 8,
        center: SHOMRIA_ITM,
        onLoad: () => {
          setReady(true);
          try {
            govmap.onEvent(govmap.events.CLICK).progress(handleClick);
          } catch (err) {
            setError(`הרשמה לאירוע קליק נכשלה: ${(err as Error).message}`);
          }
        },
      });
    } catch (err) {
      setError(`createMap נכשל: ${(err as Error).message}`);
    }
  }

  function clearAll() {
    ptsRef.current = [];
    setCount(0);
    setLast(null);
    try {
      govmap.displayGeometries({
        wkts: [],
        labels: [],
        geometryType: govmap.geometryType.POINT,
        clearExisting: true,
      });
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <Script
        src="https://www.govmap.gov.il/govmap/api/govmap.api.js"
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() => setError("טעינת סקריפט govmap נכשלה (בדוק חיבור / הרשאת דומיין לטוקן).")}
      />

      <div className="rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>עמוד בדיקה (spike).</strong> לחץ במקום כלשהו על המפה כדי להניח סמן ממוספר. המטרה:
        לוודא שהמפה נטענת, שלחיצה מחזירה קואורדינטה, ושאנחנו מציירים סמנים עם תוויות משלנו.
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            ready ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"
          }`}
        >
          {ready ? "המפה מוכנה — לחץ עליה" : "טוען מפה..."}
        </span>
        <span className="text-gray-700">{count} סמנים</span>
        {last && (
          <span className="text-gray-700" dir="ltr">
            ITM: x={last.x.toFixed(2)}, y={last.y.toFixed(2)}
          </span>
        )}
        {count > 0 && (
          <button className="btn-secondary" onClick={clearAll}>
            נקה
          </button>
        )}
      </div>

      <div
        id="govmap"
        className="w-full overflow-hidden rounded-xl border border-gray-200"
        style={{ height: 560 }}
      />
    </div>
  );
}
