import * as mupdf from "mupdf";

/**
 * Rasterize the first page of a PDF to a PNG at the given DPI. Uses MuPDF (WASM),
 * so it works on Vercel without native binaries. Used to produce an editable
 * image of the security map (openable in MS Paint) from the same PDF.
 */
export function renderPdfToPng(pdf: Uint8Array, dpi = 200): Uint8Array {
  const doc = mupdf.Document.openDocument(pdf, "application/pdf");
  const page = doc.loadPage(0);
  const scale = dpi / 72;
  const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
  return pix.asPNG();
}
