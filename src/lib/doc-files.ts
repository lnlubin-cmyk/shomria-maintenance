/**
 * Shared rules for admin-uploaded documents. A document is either a PDF or a
 * raster image; the app renders whichever was uploaded (PDF.js viewer vs an
 * <img>), decided at runtime from the stored file's extension. SVG is
 * intentionally NOT accepted — it can carry embedded script.
 *
 * Pure helpers with no server-only imports, so client components may import the
 * accept string too.
 */

/** `accept` attribute for the file inputs. */
export const DOC_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

/** Human hint listing the accepted kinds (Hebrew). */
export const DOC_KINDS_HE = "PDF או תמונה (JPG/PNG/WEBP)";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** The canonical extension for an accepted file, or null if it's unsupported. */
export function docExt(file: File): string | null {
  if (file.type && EXT_BY_MIME[file.type]) return EXT_BY_MIME[file.type];
  const m = file.name.toLowerCase().match(/\.(pdf|jpe?g|png|webp)$/);
  if (!m) return null;
  return m[1] === "jpeg" ? "jpg" : m[1];
}

/** The Content-Type to store for a canonical extension. */
export function docContentType(ext: string): string {
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

/** How to render a stored file: image if its path is an image, else PDF. */
export function docKind(path: string | null | undefined): "pdf" | "image" {
  return path && /\.(jpe?g|png|webp)$/i.test(path) ? "image" : "pdf";
}
