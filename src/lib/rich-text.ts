/**
 * Minimal, strict sanitizer for admin rich text. Keeps ONLY inline
 * bold / italic / underline plus line-break / paragraph structure, and emits NO
 * attributes whatsoever — so there is no vector for scripts, event handlers,
 * `javascript:` URLs, or inline styles. Any other tag is dropped (its text is
 * kept), and <script>/<style> blocks are removed with their contents.
 *
 * It's a pure, dependency-free function so the same rules run in three places:
 * when saving (server actions), when rendering (RichText), and before loading a
 * stored value back into the editor.
 *
 * The optional `linkify` mode is RENDER-ONLY: it turns URLs and Israeli phone
 * numbers found in the text into clickable <a> links. It's never used at save
 * time, so the stored value and the editor stay free of generated markup.
 */

import { normalizeIsraeliPhone } from "./phone";

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "br", "p", "div"]);
const VOID_TAGS = new Set(["br"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// http(s):// or www. links, or an Israeli phone number (must start with 0 or
// +972 so we don't grab arbitrary long digit runs). Phone candidates are still
// validated by normalizeIsraeliPhone() below, so wrong-length numbers fall back
// to plain text.
const LINK_SOURCE =
  String.raw`((?:https?:\/\/|www\.)[^\s<]+)` +
  "|" +
  String.raw`((?:\+?972[-\s.]?|0)\d(?:[-\s.]?\d){7,9})`;

const LINK_CLASS = "text-brand-600 underline break-words";

/**
 * Turn a plain (already-untagged) text run into HTML: URLs and Israeli phone
 * numbers become <a> links; everything else is HTML-escaped. Safe to inject —
 * only http(s)/www hrefs and tel: numbers are produced, and all visible text is
 * escaped. Used on the text nodes only, so it never touches tags/attributes.
 */
export function linkifyText(text: string | null | undefined): string {
  if (!text) return "";
  const re = new RegExp(LINK_SOURCE, "gi");
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out += escapeHtml(text.slice(last, m.index));
    if (m[1]) {
      // URL — trim trailing sentence punctuation back out of the link.
      let url = m[1];
      let trail = "";
      const tm = url.match(/[.,;:!?)\]]+$/);
      if (tm) {
        trail = url.slice(url.length - tm[0].length);
        url = url.slice(0, url.length - tm[0].length);
      }
      const href = (url.startsWith("www.") ? `https://${url}` : url)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;");
      out += `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${LINK_CLASS}">${escapeHtml(url)}</a>${escapeHtml(trail)}`;
    } else {
      // Phone — only link it if it normalises to a valid Israeli number.
      const raw = m[2];
      const e164 = normalizeIsraeliPhone(raw);
      out += e164
        ? `<a href="tel:${e164}" class="${LINK_CLASS}">${escapeHtml(raw)}</a>`
        : escapeHtml(raw);
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

export function sanitizeRichText(
  input: string | null | undefined,
  opts: { linkify?: boolean } = {}
): string {
  if (!input) return "";
  // With linkify on, emit each text run as linkified+escaped HTML; otherwise
  // pass text through unchanged (identical to the original behaviour).
  const emit = opts.linkify ? linkifyText : (t: string) => t;
  let s = String(input);
  // Remove script/style blocks (with contents) and comments outright.
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += emit(s.slice(i));
      break;
    }
    out += emit(s.slice(i, lt)); // plain text before the tag (never contains '<')

    const gt = s.indexOf(">", lt);
    if (gt === -1) {
      // A stray '<' with no closing '>': keep it as literal, escaped text.
      out += "&lt;" + emit(s.slice(lt + 1));
      break;
    }

    const inner = s.slice(lt + 1, gt);
    // A real tag has its name immediately after '<' (or after '</'). Anything
    // else — e.g. "a < b" — is literal text, matching how browsers parse it.
    const m = inner.match(/^(\/)?([a-zA-Z][a-zA-Z0-9]*)/);
    if (!m) {
      out += "&lt;";
      i = lt + 1;
      continue;
    }

    const closing = m[1] === "/";
    const name = m[2].toLowerCase();
    if (ALLOWED.has(name)) {
      if (VOID_TAGS.has(name)) out += "<br>";
      else out += closing ? `</${name}>` : `<${name}>`;
    }
    // Disallowed tag → dropped entirely (no tag, no attributes emitted).
    i = gt + 1;
  }

  return out.trim();
}

/** True when the value contains markup (so it should render as sanitized HTML). */
export function hasRichMarkup(value: string | null | undefined): boolean {
  return !!value && /<[a-zA-Z]/.test(value);
}
