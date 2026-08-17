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
 */

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "br", "p", "div"]);
const VOID_TAGS = new Set(["br"]);

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  // Remove script/style blocks (with contents) and comments outright.
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, lt); // plain text before the tag (never contains '<')

    const gt = s.indexOf(">", lt);
    if (gt === -1) {
      // A stray '<' with no closing '>': keep it as literal, escaped text.
      out += "&lt;" + s.slice(lt + 1);
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
