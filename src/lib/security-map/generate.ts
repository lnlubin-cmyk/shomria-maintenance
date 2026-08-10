import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ALEF_BOLD_BASE64 } from "./alef-bold";

export type MapBuilding = { name: string; lat: number; lon: number };

// Esri World Imagery (XYZ). z18 is the deepest level with real imagery over
// Shomria (z19 returns "not available" placeholders). ~0.5 m/px.
const Z = 18;
const TILE = 256;
const WORLD = TILE * 2 ** Z;
const ESRI = (z: number, y: number, x: number) =>
  `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

const pxX = (lon: number) => ((lon + 180) / 360) * WORLD;
const pxY = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * WORLD;
};

/** Split a label into up to two rows: when it holds more than one name
 *  (separated by / , & | or " ו "), put the first on row 1 and the rest on row 2. */
function splitNames(name: string): string[] {
  const parts = name
    .split(/\s*[/|,&\n]\s*|\s+ו\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length >= 2 ? [parts[0], parts.slice(1).join(" ")] : [name];
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Draw text with a thin white outline (halo) so it stays readable over the
 *  aerial photo without a solid background box covering the image. */
function haloText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number) {
  const o = 0.6;
  const white = rgb(1, 1, 1);
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]] as const)
    page.drawText(text, { x: x + dx, y: y + dy, size, font, color: white });
  page.drawText(text, { x, y, size, font, color: rgb(0.05, 0.05, 0.05) });
}

/**
 * Build an A3 (portrait) security map PDF: aerial background with a dot and the
 * family name at every house. Returns the PDF bytes.
 */
export async function generateSecurityMapPdf(buildings: MapBuilding[]): Promise<Uint8Array> {
  // Bounding box (+ margin) over all houses.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const b of buildings) {
    minLon = Math.min(minLon, b.lon); maxLon = Math.max(maxLon, b.lon);
    minLat = Math.min(minLat, b.lat); maxLat = Math.max(maxLat, b.lat);
  }
  // Margin around the houses' bounding box (fraction of span on each side).
  // Larger = more surrounding area shown = more zoomed out.
  const mf = 0.3;
  const dLon = (maxLon - minLon) * mf, dLat = (maxLat - minLat) * mf;
  minLon -= dLon; maxLon += dLon; minLat -= dLat; maxLat += dLat;

  const gxMin = pxX(minLon), gxMax = pxX(maxLon);
  const gyMin = pxY(maxLat), gyMax = pxY(minLat); // north = smaller py
  const W = gxMax - gxMin, H = gyMax - gyMin;

  // Tiles covering the bbox.
  const txMin = Math.floor(gxMin / TILE), txMax = Math.floor(gxMax / TILE);
  const tyMin = Math.floor(gyMin / TILE), tyMax = Math.floor(gyMax / TILE);
  const tileList: { tx: number; ty: number }[] = [];
  for (let tx = txMin; tx <= txMax; tx++)
    for (let ty = tyMin; ty <= tyMax; ty++) tileList.push({ tx, ty });
  const tiles = (
    await pool(tileList, 12, async ({ tx, ty }) => {
      try {
        const r = await fetch(ESRI(Z, ty, tx));
        if (!r.ok) return null;
        return { tx, ty, bytes: new Uint8Array(await r.arrayBuffer()) };
      } catch {
        return null;
      }
    })
  ).filter(Boolean) as { tx: number; ty: number; bytes: Uint8Array }[];

  // PDF (A3 landscape, points).
  const A3W = 1190.55, A3H = 841.89;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(Buffer.from(ALEF_BOLD_BASE64, "base64"), { subset: true });
  const page = doc.addPage([A3W, A3H]);

  const M = { l: 22, r: 22, t: 64, b: 46 };
  const area = { x: M.l, y: M.b, w: A3W - M.l - M.r, h: A3H - M.t - M.b };
  const scale = Math.min(area.w / W, area.h / H);
  const mapW = W * scale, mapH = H * scale;
  const ox = area.x + (area.w - mapW) / 2;
  const oy = area.y + (area.h - mapH) / 2;
  const toPage = (gx: number, gy: number) => ({
    x: ox + (gx - gxMin) * scale,
    y: oy + mapH - (gy - gyMin) * scale,
  });

  // Aerial tiles.
  for (const t of tiles) {
    const img = t.bytes[0] === 0x89 ? await doc.embedPng(t.bytes) : await doc.embedJpg(t.bytes);
    const p = toPage(t.tx * TILE, t.ty * TILE + TILE); // bottom-left corner
    page.drawImage(img, { x: p.x, y: p.y, width: TILE * scale, height: TILE * scale });
  }

  // Mask tile bleed outside the map area, then frame it.
  const white = rgb(1, 1, 1);
  page.drawRectangle({ x: 0, y: 0, width: A3W, height: oy, color: white });
  page.drawRectangle({ x: 0, y: oy + mapH, width: A3W, height: A3H - (oy + mapH), color: white });
  page.drawRectangle({ x: 0, y: 0, width: ox, height: A3H, color: white });
  page.drawRectangle({ x: ox + mapW, y: 0, width: A3W - (ox + mapW), height: A3H, color: white });
  page.drawRectangle({ x: ox, y: oy, width: mapW, height: mapH, borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 1 });

  // Labels with simple de-collision.
  const SIZE = 5.5, LH = 6.2, padX = 1.6, padY = 1.2, dot = 1.7;
  const placed: Rect[] = [];
  const items = buildings
    .map((b) => {
      const p = toPage(pxX(b.lon), pxY(b.lat));
      const lines = splitNames(b.name); // pdf-lib renders Hebrew RTL correctly
      const w = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, SIZE)));
      return { p, lines, bw: w + padX * 2, bh: lines.length * LH + padY * 2 };
    })
    .sort((a, b) => a.p.y - b.p.y);

  for (const it of items) {
    const { p, lines, bw, bh } = it;
    const cands: Rect[] = [
      { x: p.x - bw / 2, y: p.y + dot + 2, w: bw, h: bh }, // above
      { x: p.x - bw / 2, y: p.y - dot - 2 - bh, w: bw, h: bh }, // below
      { x: p.x + dot + 2, y: p.y - bh / 2, w: bw, h: bh }, // right
      { x: p.x - dot - 2 - bw, y: p.y - bh / 2, w: bw, h: bh }, // left
    ];
    let box: Rect | null = null;
    for (const r of cands) {
      if (r.x < ox || r.x + r.w > ox + mapW || r.y < oy || r.y + r.h > oy + mapH) continue;
      if (placed.some((q) => overlaps(r, q))) continue;
      box = r;
      break;
    }
    if (!box) box = cands[0];
    placed.push(box);

    page.drawCircle({ x: p.x, y: p.y, size: dot, color: rgb(0.85, 0.1, 0.1), borderColor: white, borderWidth: 0.4 });
    lines.forEach((ln, i) => {
      const lw = font.widthOfTextAtSize(ln, SIZE);
      const tx = box!.x + (box!.w - lw) / 2;
      const ty = box!.y + box!.h - padY - (i + 1) * LH + (LH - SIZE) / 2 + 1;
      haloText(page, font, ln, tx, ty, SIZE);
    });
  }

  drawCompass(page, font, { ox, oy, mapW, mapH });
  drawChrome(page, font, { A3W, A3H, M, ox, oy, mapW, minLat, maxLat, scale });
  return doc.save();
}

/** A single direction label — white box + centered bold text — centered on (cx, cy). */
function drawDirection(page: PDFPage, font: PDFFont, text: string, cx: number, cy: number) {
  const size = 11;
  const w = font.widthOfTextAtSize(text, size);
  const bw = w + 7, bh = size + 5;
  page.drawRectangle({
    x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh,
    color: rgb(1, 1, 1), opacity: 0.85, borderColor: rgb(0.1, 0.1, 0.1), borderWidth: 0.5,
  });
  page.drawText(text, { x: cx - w / 2, y: cy - size / 2 + 1.5, size, font, color: rgb(0.05, 0.05, 0.05) });
}

/** Compass directions inside the map edges (north is up). */
function drawCompass(
  page: PDFPage,
  font: PDFFont,
  o: { ox: number; oy: number; mapW: number; mapH: number }
) {
  const cx = o.ox + o.mapW / 2, cy = o.oy + o.mapH / 2;
  drawDirection(page, font, "צפון", cx, o.oy + o.mapH - 14);
  drawDirection(page, font, "דרום", cx, o.oy + 14);
  drawDirection(page, font, "מזרח", o.ox + o.mapW - 26, cy);
  drawDirection(page, font, "מערב", o.ox + 26, cy);
}

/** Title, date, internal-use note, imagery credit, scale bar. */
function drawChrome(
  page: PDFPage,
  font: PDFFont,
  o: { A3W: number; A3H: number; M: { l: number; r: number }; ox: number; oy: number; mapW: number; minLat: number; maxLat: number; scale: number }
) {
  const ink = rgb(0.1, 0.1, 0.1), gray = rgb(0.35, 0.35, 0.35);
  const title = "מפת ביטחון — קהילת עצמונה-שומריה";
  page.drawText(title, { x: (o.A3W - font.widthOfTextAtSize(title, 18)) / 2, y: o.A3H - 40, size: 18, font, color: ink });

  const now = new Date();
  const dstr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  page.drawText(dstr, { x: o.A3W - o.M.r - font.widthOfTextAtSize(dstr, 9), y: o.A3H - 20, size: 9, font, color: gray });
  const internal = "מסמך פנימי — למחלקת הביטחון";
  page.drawText(internal, { x: o.M.l, y: o.A3H - 20, size: 9, font, color: gray });

  page.drawText("Imagery: Esri, Maxar, Earthstar Geographics", { x: o.M.l, y: 20, size: 8, font, color: rgb(0.4, 0.4, 0.4) });

  // Scale bar (100 m).
  const mPerGpx = (Math.cos(((o.minLat + o.maxLat) / 2) * Math.PI / 180) * 2 * Math.PI * 6378137) / WORLD;
  const mPerPt = mPerGpx / o.scale;
  const barPt = 100 / mPerPt;
  const bx = o.A3W - o.M.r - barPt, by = 24;
  const bar = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.5, color: ink });
  bar(bx, by, bx + barPt, by);
  bar(bx, by - 3, bx, by + 3);
  bar(bx + barPt, by - 3, bx + barPt, by + 3);
  const sl = "100 מ׳";
  page.drawText(sl, { x: bx + barPt - font.widthOfTextAtSize(sl, 8), y: by + 5, size: 8, font, color: ink });
}
