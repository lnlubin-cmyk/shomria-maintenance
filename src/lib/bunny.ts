/**
 * Bunny Stream configuration + URL helpers for the home-page hero.
 *
 * The library is public (delivered over the pull-zone CDN host), so these
 * values are not secret. They can be overridden via env vars if the library
 * ever changes, but sensible defaults for the Shomria library are baked in.
 */
export const BUNNY_STREAM_HOST =
  process.env.NEXT_PUBLIC_BUNNY_STREAM_HOST || "vz-793a7a02-867.b-cdn.net";

export const BUNNY_STREAM_LIBRARY =
  process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY || "720402";

// Which MP4 rendition to play. Bunny creates this when "MP4 Fallback" is enabled
// in the library. 720p is a good default for a hero; override if your source is
// lower resolution.
export const BUNNY_STREAM_MP4_RES = process.env.NEXT_PUBLIC_BUNNY_STREAM_RES || "720p";

/** Direct MP4 URL (requires "MP4 Fallback" enabled on the library). */
export function bunnyMp4Url(guid: string, res: string = BUNNY_STREAM_MP4_RES): string {
  return `https://${BUNNY_STREAM_HOST}/${guid}/play_${res}.mp4`;
}

/** Poster / thumbnail image for a video. */
export function bunnyThumb(guid: string): string {
  return `https://${BUNNY_STREAM_HOST}/${guid}/thumbnail.jpg`;
}

/** Bunny's own iframe player embed URL (not used for the hero, kept for reference). */
export function bunnyIframeUrl(guid: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_STREAM_LIBRARY}/${guid}`;
}

/**
 * Pull a Bunny video GUID (a UUID) out of whatever the admin pastes: a bare
 * GUID, an embed URL (…/embed/{library}/{guid}), an iframe snippet, or a direct
 * play/thumbnail URL. Returns null if no GUID is found.
 */
export function parseBunnyGuid(input: string): string | null {
  const m = (input || "").match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return m ? m[0].toLowerCase() : null;
}
