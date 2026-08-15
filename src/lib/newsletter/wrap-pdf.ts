import { PDFDocument } from "pdf-lib";

/**
 * Wrap a cropped section image (PNG) into a single-page PDF whose page is that
 * image — nothing else. Storing sections as PDFs lets them flow through the
 * existing community-document pipeline (upload, signed URL, /community viewer)
 * unchanged, while the page contains only the cropped pixels (no hidden content,
 * no surrounding page). The page width is fixed to A4 so the section reads at a
 * natural size; the height follows the image's aspect ratio.
 */
export async function imageToPdf(png: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(png);
  const width = 595.28; // A4 width in points
  const height = (img.height / img.width) * width;
  const page = doc.addPage([width, height]);
  page.drawImage(img, { x: 0, y: 0, width, height });
  return doc.save();
}
