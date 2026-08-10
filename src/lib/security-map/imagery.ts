/**
 * Aerial imagery source for the security map, chosen by env vars:
 *
 *   MAP_IMAGERY = esri (default) | google
 *   GOOGLE_MAPS_API_KEY = <key>            (required for google)
 *   MAP_IMAGERY_ZOOM = <number>            (optional override)
 *
 * Both sources use the standard Web-Mercator XYZ tiling scheme, so only the
 * zoom level and the per-tile fetch differ. If Google is selected but the key
 * is missing or a session can't be created, we fall back to Esri so the map
 * always renders.
 */
export type ImagerySource = {
  z: number;
  attribution: string;
  fetchTile: (x: number, y: number) => Promise<Uint8Array | null>;
};

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

function esriSource(): ImagerySource {
  const z = Number(process.env.MAP_IMAGERY_ZOOM) || 18; // deepest Esri level over Shomria
  return {
    z,
    attribution: "Imagery: Esri, Maxar, Earthstar Geographics",
    fetchTile: (x, y) =>
      fetchBytes(
        `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
      ),
  };
}

export async function getImagerySource(): Promise<ImagerySource> {
  const provider = (process.env.MAP_IMAGERY || "esri").toLowerCase();
  const key = process.env.GOOGLE_MAPS_API_KEY;

  if (provider === "google" && key) {
    // Google Map Tiles API needs a session token before fetching tiles.
    const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapType: "satellite", language: "en-US", region: "IL" }),
    });
    if (res.ok) {
      const { session } = (await res.json()) as { session?: string };
      if (session) {
        const z = Number(process.env.MAP_IMAGERY_ZOOM) || 19; // Google has deeper, sharper imagery
        return {
          z,
          attribution: "Imagery: Google",
          // Note: Google tiles are /{z}/{x}/{y} (x before y).
          fetchTile: (x, y) =>
            fetchBytes(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${session}&key=${key}`),
        };
      }
    }
    // fall through to Esri if the session couldn't be created
  }

  return esriSource();
}
