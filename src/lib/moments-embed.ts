/**
 * Pure helpers for "רגעים שזוכרים": detect which provider a pasted link belongs
 * to, and turn a stored moment into the URLs the UI needs (embed / thumbnail /
 * external open). No server imports — safe to use from client components too.
 */
import type { Moment, MomentProvider, MomentView } from "@/lib/types";
import { parseBunnyGuid, bunnyIframeUrl, bunnyThumb } from "@/lib/bunny";

const YT_ID = /^[a-zA-Z0-9_-]{11}$/;
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,}$/;

/** Extract an 11-char YouTube video id from a URL or a bare id. */
export function parseYoutubeId(input: string): string | null {
  const s = (input || "").trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      return YT_ID.test(id) ? id : null;
    }
    if (!u.hostname.includes("youtube")) return null;
    const v = u.searchParams.get("v");
    if (v && YT_ID.test(v)) return v;
    const m = u.pathname.match(/\/(embed|shorts|v|live)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[2];
  } catch {
    /* not a URL */
  }
  return null;
}

/** Extract a Google Drive *file* id from a share URL (folders are not files). */
export function parseDriveFileId(input: string): string | null {
  const s = (input || "").trim();
  try {
    const u = new URL(s);
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("docs.google.com")) return null;
    const byPath = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (byPath && DRIVE_ID.test(byPath[1])) return byPath[1];
    const byQuery = u.searchParams.get("id");
    if (byQuery && DRIVE_ID.test(byQuery)) return byQuery;
  } catch {
    /* not a URL */
  }
  return null;
}

/** A plain http(s) URL, or null. Rejects javascript:/data:/protocol-relative. */
function safeHttpUrl(input: string): string | null {
  try {
    const u = new URL((input || "").trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    /* not an absolute URL */
  }
  return null;
}

/**
 * Work out the provider + stored ref for a pasted link. YouTube, Drive files and
 * Bunny videos are recognised and embedded; anything else that's a valid http(s)
 * URL is kept as an external "link" (opened in a new tab, never iframed).
 */
export function detectMoment(input: string): { provider: MomentProvider; ref: string } | null {
  const s = (input || "").trim();
  if (!s) return null;

  const yt = parseYoutubeId(s);
  if (yt) return { provider: "youtube", ref: yt };

  const drive = parseDriveFileId(s);
  if (drive) return { provider: "drive", ref: drive };

  const bunny = parseBunnyGuid(s);
  if (bunny) return { provider: "bunny", ref: bunny };

  const url = safeHttpUrl(s);
  if (url) return { provider: "link", ref: url };

  return null;
}

const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const youtubeEmbed = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
const youtubeWatch = (id: string) => `https://youtu.be/${id}`;

const driveEmbed = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
const driveThumb = (id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w640`;
const driveView = (id: string) => `https://drive.google.com/file/d/${id}/view`;

/** Resolve a stored moment row into the URLs the UI renders. */
export function resolveMoment(m: Moment): MomentView {
  const base = {
    id: m.id,
    title: m.title,
    description: m.description,
    provider: m.provider,
    eventDate: m.event_date,
  };
  switch (m.provider) {
    case "youtube":
      return { ...base, embedUrl: youtubeEmbed(m.ref), thumb: youtubeThumb(m.ref), href: youtubeWatch(m.ref) };
    case "drive":
      return { ...base, embedUrl: driveEmbed(m.ref), thumb: driveThumb(m.ref), href: driveView(m.ref) };
    case "bunny":
      return { ...base, embedUrl: bunnyIframeUrl(m.ref), thumb: bunnyThumb(m.ref), href: bunnyIframeUrl(m.ref) };
    case "link":
    default:
      return { ...base, embedUrl: null, thumb: null, href: m.ref };
  }
}

/** Add an autoplay flag when the viewer clicks play (user-initiated). */
export function withAutoplay(embedUrl: string, provider: MomentProvider): string {
  if (provider === "youtube") return `${embedUrl}&autoplay=1`;
  if (provider === "bunny") return `${embedUrl}?autoplay=true`;
  return embedUrl;
}

const PROVIDER_LABELS: Record<MomentProvider, string> = {
  youtube: "YouTube",
  drive: "Google Drive",
  bunny: "Bunny",
  link: "קישור חיצוני",
};
export const providerLabel = (p: MomentProvider) => PROVIDER_LABELS[p] ?? p;
