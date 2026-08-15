import * as mupdf from "mupdf";

/**
 * Newsletter rendering + cropping (server-only; uses MuPDF WASM).
 *
 * The kibbutz newsletter (הידיעון) is an A4 PDF whose pages carry a decorative
 * hand-drawn border. Every crop must EXCLUDE that border, so we first detect the
 * inner "content box" of each page and treat that — not the raw page — as the
 * coordinate space the admin and the AI work in. Section boxes are therefore
 * normalized 0..1 *within the content box*, which makes every crop frame-free by
 * construction.
 */

const PREVIEW_DPI = 110; // for the review images shown in the admin UI
const CROP_DPI = 150; // for the final published crops

/** A rectangle in page points (top-left origin, y increasing downward). */
export interface ContentBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A normalized rectangle (0..1) within a page's content box. */
export interface Box01 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PagePreview {
  index: number; // 0-based page index
  content: ContentBox; // frame-free content area, in page points
  previewW: number; // preview image size, in px
  previewH: number;
  jpeg: Uint8Array; // frame-free preview (already cropped to the content box)
}

const RGB = mupdf.ColorSpace.DeviceRGB;

/**
 * Find the inner edge of the decorative frame on each side by walking inward
 * from the edge: skip the outer margin, cross the dark frame band, then stop at
 * the inner white margin. Returns a box in the pixmap's own pixel coordinates.
 * Falls back to a small fixed inset on any side where no frame is detected.
 */
function detectContentBoxPx(pix: mupdf.Pixmap): ContentBox {
  const w = pix.getWidth();
  const h = pix.getHeight();
  const comp = pix.getNumberOfComponents();
  const stride = pix.getStride();
  const px = pix.getPixels();
  const DARK = 170; // avg luminance below this counts as "ink"

  const isDark = (x: number, y: number) => {
    const i = y * stride + x * comp;
    return (px[i] + px[i + 1] + px[i + 2]) / 3 < DARK;
  };
  const colInk = (x: number, y0: number, y1: number) => {
    let n = 0;
    let ink = 0;
    for (let y = y0; y < y1; y += 2) {
      n++;
      if (isDark(x, y)) ink++;
    }
    return ink / n;
  };
  const rowInk = (y: number, x0: number, x1: number) => {
    let n = 0;
    let ink = 0;
    for (let x = x0; x < x1; x += 2) {
      n++;
      if (isDark(x, y)) ink++;
    }
    return ink / n;
  };

  const pad = Math.round(0.006 * w); // a little breathing room past the frame
  const yc0 = Math.round(h * 0.2);
  const yc1 = Math.round(h * 0.8);
  const xc0 = Math.round(w * 0.2);
  const xc1 = Math.round(w * 0.8);

  // Scan forward from an edge; return the position just past the frame band.
  const edge = (dim: number, inkAt: (d: number) => number, limitFrac: number, defFrac: number) => {
    const limit = Math.round(dim * limitFrac);
    let state: "outer" | "frame" = "outer";
    for (let d = 0; d < limit; d++) {
      const f = inkAt(d);
      if (state === "outer" && f > 0.18) state = "frame";
      else if (state === "frame" && f < 0.05) return Math.min(d + pad, limit);
    }
    return Math.round(dim * defFrac);
  };

  const left = edge(w, (d) => colInk(d, yc0, yc1), 0.15, 0.03);
  const right = w - edge(w, (d) => colInk(w - 1 - d, yc0, yc1), 0.15, 0.03);
  const top = edge(h, (d) => rowInk(d, xc0, xc1), 0.12, 0.03);
  const bottom = h - edge(h, (d) => rowInk(h - 1 - d, xc0, xc1), 0.12, 0.03);

  return { left, top, right, bottom };
}

/** Compute the frame-free content box of one page, in page points. */
function pageContentBox(page: mupdf.Page): ContentBox {
  const scale = PREVIEW_DPI / 72;
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), RGB, false, true);
  const cb = detectContentBoxPx(pix);
  return {
    left: cb.left / scale,
    top: cb.top / scale,
    right: cb.right / scale,
    bottom: cb.bottom / scale,
  };
}

/** Render a rectangle of a page (in points) to a PNG at the given DPI. */
function renderRect(page: mupdf.Page, rectPt: ContentBox, dpi: number): Uint8Array {
  const scale = dpi / 72;
  const bbox: [number, number, number, number] = [
    Math.round(rectPt.left * scale),
    Math.round(rectPt.top * scale),
    Math.round(rectPt.right * scale),
    Math.round(rectPt.bottom * scale),
  ];
  const pix = new mupdf.Pixmap(RGB, bbox, false);
  pix.clear(255);
  const dev = new mupdf.DrawDevice(mupdf.Matrix.scale(scale, scale), pix);
  page.run(dev, mupdf.Matrix.identity);
  dev.close();
  return pix.asPNG();
}

/**
 * Render every page to a frame-free preview image (JPEG) plus its content box.
 * These previews are what the admin sees and what the AI is shown, so all boxes
 * are expressed relative to them.
 */
export function renderNewsletter(pdf: Uint8Array): PagePreview[] {
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const scale = PREVIEW_DPI / 72;
  const out: PagePreview[] = [];
  const n = doc.countPages();
  for (let i = 0; i < n; i++) {
    const page = doc.loadPage(i);
    const content = pageContentBox(page);
    const bbox: [number, number, number, number] = [
      Math.round(content.left * scale),
      Math.round(content.top * scale),
      Math.round(content.right * scale),
      Math.round(content.bottom * scale),
    ];
    const pix = new mupdf.Pixmap(RGB, bbox, false);
    pix.clear(255);
    const dev = new mupdf.DrawDevice(mupdf.Matrix.scale(scale, scale), pix);
    page.run(dev, mupdf.Matrix.identity);
    dev.close();
    out.push({
      index: i,
      content,
      previewW: bbox[2] - bbox[0],
      previewH: bbox[3] - bbox[1],
      jpeg: pix.asJPEG(80),
    });
  }
  return out;
}

/**
 * Crop one section to a PNG. `box` is normalized 0..1 within the page's
 * content box, so the result never contains the decorative frame. The content
 * box is recomputed from the PDF here (deterministic) rather than trusted from
 * the client.
 */
export function cropSection(pdf: Uint8Array, pageIndex: number, box: Box01): Uint8Array {
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const page = doc.loadPage(pageIndex);
  const c = pageContentBox(page);
  const cw = c.right - c.left;
  const ch = c.bottom - c.top;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const rect: ContentBox = {
    left: c.left + clamp(box.x0) * cw,
    top: c.top + clamp(box.y0) * ch,
    right: c.left + clamp(box.x1) * cw,
    bottom: c.top + clamp(box.y1) * ch,
  };
  return renderRect(page, rect, CROP_DPI);
}
