"use client";

import { useState } from "react";
import Script from "next/script";

/**
 * SPIKE — throwaway proof that govmap works with our token. It confirms three
 * things in the browser (which can't be tested headlessly):
 *   1. the map renders with our token,
 *   2. govmap.getXY() returns a coordinate when we click,
 *   3. govmap.displayGeometries() paints our own labeled marker (client-side,
 *      no govmap layer).
 *
 * Once confirmed, this is replaced by the real map view + admin placement.
 *
 * govmap works in ITM (EPSG:2039). The center below is an approximate ITM point
 * near the Lachish/Shomria area — pan/zoom to find the kibbutz; exact centering
 * comes later.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const govmap: any;

const SHOMRIA_ITM = { x: 187500, y: 588500 }; // approximate — adjust after we see it

export default function MapSpike({ token }: { token: string }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [markers, setMarkers] = useState<string[]>([]);

  function initMap() {
    try {
      govmap.createMap("govmap", {
        token,
        // background "2" is usually the orthophoto (aerial); "0"/"1" are base
        // maps. If this isn't the aerial layer, we'll switch the value.
        background: "2",
        level: 8,
        center: SHOMRIA_ITM,
      });
      setReady(true);
    } catch (e) {
      setError(`createMap נכשל: ${(e as Error).message}`);
    }
  }

  function placePoint() {
    setError(null);
    try {
      govmap.getXY().progress((resp: { mapPoint: { x: number; y: number } }) => {
        const { x, y } = resp.mapPoint;
        setCoords({ x, y });
        const label = `בית ${markers.length + 1}`;
        setMarkers((m) => [...m, label]);

        // Draw our own labeled marker from client data — no govmap layer.
        govmap.displayGeometries({
          wkts: [`POINT(${x} ${y})`],
          names: [label],
          labels: [label],
          geometryType: govmap.geometryType.POINT,
          clearExisting: false,
          fontLabel: {
            fontName: "Arial",
            fontSize: 14,
            fillColor: "#1c4d38",
            strokeColor: "#ffffff",
          },
        });

        govmap.setDefaultTool();
      });
    } catch (e) {
      setError(`getXY נכשל: ${(e as Error).message}`);
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
        <strong>עמוד בדיקה (spike).</strong> מטרתו לוודא ש-govmap עובד עם הטוקן: המפה נטענת, לחיצה
        מחזירה קואורדינטה, ואנחנו מציירים סמן עם תווית משלנו. לאחר אישור — נבנה את התכונה האמיתית.
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={placePoint} disabled={!ready}>
          {ready ? "בחר נקודה על המפה" : "טוען מפה..."}
        </button>
        {coords && (
          <span className="text-sm text-gray-700" dir="ltr">
            ITM: x={coords.x.toFixed(2)}, y={coords.y.toFixed(2)} · {markers.length} סמנים
          </span>
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
