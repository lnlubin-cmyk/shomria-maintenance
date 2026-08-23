import { PDFDocument } from "pdf-lib";
import { getPageContent, type Box01 } from "@/lib/newsletter/render";

/**
 * Crop one section to a *vector* single-page PDF: the original page's real
 * content (text, images) and its link annotations are kept, and the page's
 * crop/media box is narrowed to the section's rectangle. Unlike the rasterized
 * PNG crop, this keeps links clickable and text selectable in the viewer.
 *
 * `box` is normalized 0..1 within the page's frame-free content box, so the
 * result excludes the decorative border by construction.
 */
export async function cropSectionToPdf(pdf: Uint8Array, pageIndex: number, box: Box01): Promise<Uint8Array> {
  const c = getPageContent(pdf, pageIndex); // points, top-left origin
  const cw = c.right - c.left;
  const ch = c.bottom - c.top;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const x0 = c.left + clamp(box.x0) * cw;
  const x1 = c.left + clamp(box.x1) * cw;
  const yTop0 = c.top + clamp(box.y0) * ch; // distance from top
  const yTop1 = c.top + clamp(box.y1) * ch;

  const src = await PDFDocument.load(pdf);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(src, [pageIndex]); // keeps annotations
  out.addPage(page);

  const mb = page.getMediaBox(); // {x, y, width, height}
  const cropX = mb.x + x0;
  const cropYBottom = mb.y + mb.height - yTop1; // flip top-left → PDF bottom-left
  const cropW = x1 - x0;
  const cropH = yTop1 - yTop0;

  page.setCropBox(cropX, cropYBottom, cropW, cropH);
  page.setMediaBox(cropX, cropYBottom, cropW, cropH);

  return out.save();
}
