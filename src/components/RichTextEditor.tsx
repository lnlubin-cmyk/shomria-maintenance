"use client";

import { useEffect, useRef } from "react";
import { sanitizeRichText } from "@/lib/rich-text";

/**
 * A tiny rich-text field: a Bold / Italic / Underline toolbar over a
 * contentEditable area, plus a hidden <input name={name}> that carries the HTML
 * so it submits through a normal <form action> exactly like a textarea did.
 *
 * The stored value is sanitized before it's loaded in (and again on save and on
 * render), so only the safe B/I/U + line-break subset ever lives in the editor.
 */
export default function RichTextEditor({
  name,
  defaultValue = "",
  className = "",
}: {
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  const editRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const initial = sanitizeRichText(defaultValue);

  useEffect(() => {
    if (editRef.current) editRef.current.innerHTML = initial;
    if (hiddenRef.current) hiddenRef.current.value = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    if (editRef.current && hiddenRef.current) hiddenRef.current.value = editRef.current.innerHTML;
  };

  const exec = (cmd: "bold" | "italic" | "underline") => {
    editRef.current?.focus();
    // execCommand is deprecated but universally supported and ideal for B/I/U.
    document.execCommand(cmd, false);
    sync();
  };

  const btn = "flex h-8 w-8 items-center justify-center rounded hover:bg-gray-200";

  return (
    <div className={className}>
      <div className="flex gap-1 rounded-t-lg border border-gray-300 bg-gray-50 p-1">
        {/* preventDefault on mousedown keeps the editor's text selection while clicking */}
        <button type="button" title="מודגש" className={`${btn} font-bold`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
          B
        </button>
        <button type="button" title="נטוי" className={`${btn} italic`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
          I
        </button>
        <button type="button" title="קו תחתון" className={`${btn} underline`} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
          U
        </button>
      </div>
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={sync}
        className="min-h-[100px] rounded-b-lg border border-t-0 border-gray-300 bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={initial} />
    </div>
  );
}
