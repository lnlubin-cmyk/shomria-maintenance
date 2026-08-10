import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { splitHouseLabel } from "@/lib/types";
import { ALEF_BOLD_BASE64 } from "./alef-bold";
import { getImagerySource } from "./imagery";

export type MapBuilding = { name: string; lat: number; lon: number };

const TILE = 256;

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
  const src = await getImagerySource();
  const Z = src.z;
  const WORLD = TILE * 2 ** Z;
  const pxX = (lon: number) => ((lon + 180) / 360) * WORLD;
  const pxY = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * WORLD;
  };

  // Bounding box (+ margin) over all houses.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const b of buildings) {
    minLon = Math.min(minLon, b.lon); maxLon = Math.max(maxLon, b.lon);
    minLat = Math.min(minLat, b.lat); maxLat = Math.max(maxLat, b.lat);
  }
  // Margin around the houses' bounding box (fraction of span on each side).
  const mf = 0.3;
  const dLon = (maxLon - minLon) * mf, dLat = (maxLat - minLat) * mf;
  minLon -= dLon; maxLon += dLon; minLat -= dLat; maxLat += dLat;

  // A3 landscape (points). The aerial fills the whole page — no margins.
  const A3W = 1190.55, A3H = 841.89;

  let gxMin = pxX(minLon), gxMax = pxX(maxLon);
  let gyMin = pxY(maxLat), gyMax = pxY(minLat); // north = smaller py
  let W = gxMax - gxMin, H = gyMax - gyMin;

  // Expand the bbox to the page's aspect ratio so the photo fills the page
  // exactly — no white margins and no distortion (just a little more area on the
  // wider side).
  const pageAspect = A3W / A3H;
  if (W / H < pageAspect) {
    const extra = (H * pageAspect - W) / 2;
    gxMin -= extra; gxMax += extra; W = gxMax - gxMin;
  } else {
    const extra = (W / pageAspect - H) / 2;
    gyMin -= extra; gyMax += extra; H = gyMax - gyMin;
  }

  // Tiles covering the (expanded) bbox.
  const txMin = Math.floor(gxMin / TILE), txMax = Math.floor(gxMax / TILE);
  const tyMin = Math.floor(gyMin / TILE), tyMax = Math.floor(gyMax / TILE);
  const tileList: { tx: number; ty: number }[] = [];
  for (let tx = txMin; tx <= txMax; tx++)
    for (let ty = tyMin; ty <= tyMax; ty++) tileList.push({ tx, ty });
  const tiles = (
    await pool(tileList, 12, async ({ tx, ty }) => {
      const bytes = await src.fetchTile(tx, ty);
      return bytes ? { tx, ty, bytes } : null;
    })
  ).filter(Boolean) as { tx: number; ty: number; bytes: Uint8Array }[];

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(Buffer.from(ALEF_BOLD_BASE64, "base64"), { subset: true });
  const page = doc.addPage([A3W, A3H]);

  // Full-bleed: the aerial covers the entire page (bbox aspect matches the page).
  const scale = A3W / W;
  const mapW = A3W, mapH = A3H, ox = 0, oy = 0;
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

  const white = rgb(1, 1, 1);

  // Labels with simple de-collision.
  const SIZE = 5.5, LH = 6.2, padX = 1.6, padY = 1.2, dot = 1.7;
  const placed: Rect[] = [];
  const items = buildings
    .map((b) => {
      const p = toPage(pxX(b.lon), pxY(b.lat));
      const lines = splitHouseLabel(b.name); // pdf-lib renders Hebrew RTL correctly
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
  drawChrome(page, font, { A3W, A3H, minLat, maxLat, scale, world: WORLD, attribution: src.attribution });
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

/** A text label on a translucent white chip, so it reads over the aerial.
 *  align: "l" left-anchored, "r" right-anchored at x, "c" centered on x. */
function chip(page: PDFPage, font: PDFFont, text: string, size: number, x: number, y: number, align: "l" | "r" | "c") {
  const w = font.widthOfTextAtSize(text, size);
  const bx = align === "r" ? x - w : align === "c" ? x - w / 2 : x;
  page.drawRectangle({ x: bx - 4, y: y - 3, width: w + 8, height: size + 6, color: rgb(1, 1, 1), opacity: 0.72 });
  page.drawText(text, { x: bx, y, size, font, color: rgb(0.1, 0.1, 0.1) });
}

/** Title, date, internal-use note, imagery credit, scale bar — all overlaid on
 *  the full-bleed map with translucent backings. */
function drawChrome(
  page: PDFPage,
  font: PDFFont,
  o: { A3W: number; A3H: number; minLat: number; maxLat: number; scale: number; world: number; attribution: string }
) {
  const pad = 12;
  // Title + internal note, top-right (RTL).
  chip(page, font, "מפת ביטחון — קהילת עצמונה-שומריה", 16, o.A3W - pad, o.A3H - pad - 16, "r");
  chip(page, font, "מסמך פנימי — למחלקת הביטחון", 9, o.A3W - pad, o.A3H - pad - 32, "r");

  // Date, top-left.
  const now = new Date();
  const dstr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  chip(page, font, dstr, 9, pad, o.A3H - pad - 9, "l");

  // Imagery credit, bottom-left.
  chip(page, font, o.attribution, 8, pad, pad, "l");

  // Scale bar (100 m), bottom-right on a chip.
  const mPerGpx = (Math.cos(((o.minLat + o.maxLat) / 2) * Math.PI / 180) * 2 * Math.PI * 6378137) / o.world;
  const barPt = 100 / (mPerGpx / o.scale);
  const label = "100 מ׳";
  const boxW = Math.max(barPt, font.widthOfTextAtSize(label, 8)) + 10;
  const boxX = o.A3W - pad - boxW;
  page.drawRectangle({ x: boxX, y: pad, width: boxW, height: 24, color: rgb(1, 1, 1), opacity: 0.72 });
  const bx = boxX + 5, by = pad + 6;
  const ink = rgb(0.1, 0.1, 0.1);
  const bar = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 1.5, color: ink });
  bar(bx, by, bx + barPt, by);
  bar(bx, by - 3, bx, by + 3);
  bar(bx + barPt, by - 3, bx + barPt, by + 3);
  page.drawText(label, { x: bx, y: by + 5, size: 8, font, color: ink });
}
