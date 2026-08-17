import { sanitizeRichText, hasRichMarkup } from "@/lib/rich-text";

/**
 * Renders admin rich text. Plain (legacy) values render as text with line breaks
 * preserved; values that contain markup render as sanitized HTML (bold / italic
 * / underline + line breaks only). Sanitizing here too means even content that
 * somehow bypassed save-time cleaning can't inject anything.
 */
export default function RichText({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const v = value ?? "";
  if (!hasRichMarkup(v)) {
    return <div className={`whitespace-pre-line ${className}`}>{v}</div>;
  }
  const html = sanitizeRichText(v.replace(/\r?\n/g, "<br>"));
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
