/**
 * Repair an uploaded file's name when the multipart/form-data parser decoded a
 * UTF-8 name as Latin-1 — which mangles Hebrew names (e.g. "××××¢××" instead of
 * "ידיעון"). This only rewrites a name that is *exactly* the Latin-1 form of
 * valid UTF-8 (it round-trips), so correct ASCII / already-Unicode names — and
 * names generated server-side from real strings — pass through untouched.
 */
export function decodeUploadedFileName(name: string): string {
  try {
    const reDecoded = Buffer.from(name, "latin1").toString("utf8");
    if (reDecoded !== name && Buffer.from(reDecoded, "utf8").toString("latin1") === name) {
      return reDecoded;
    }
  } catch {
    /* leave the name as-is */
  }
  return name;
}
