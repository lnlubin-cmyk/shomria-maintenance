import { sanitizeRichText, hasRichMarkup, linkifyText } from "@/lib/rich-text";

/**
 * Renders admin rich text. Plain (legacy) values render as text with line breaks
 * preserved; values that contain markup render as sanitized HTML (bold / italic
 * / underline + line breaks only). Sanitizing here too means even content that
 * somehow bypassed save-time cleaning can't inject anything.
 *
 * In both cases URLs and Israeli phone numbers in the text are turned into
 * clickable links (opening the browser / the phone dialer) via linkifyText,
 * which escapes everything else — so this stays injection-safe.
 */
export default function RichText({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const v = value ?? "";
  if (!hasRichMarkup(v)) {
    // Plain text: keep pre-line whitespace/newlines; linkify escapes the rest.
    return (
      <div
        className={`whitespace-pre-line ${className}`}
        dangerouslySetInnerHTML={{ __html: linkifyText(v) }}
      />
    );
  }
  const html = sanitizeRichText(v.replace(/\r?\n/g, "<br>"), { linkify: true });
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
