"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF inline by drawing each page to a canvas with PDF.js. Works
 * consistently on mobile and desktop (unlike an <iframe> of the PDF). The worker
 * is self-hosted from /public so no external CDN is needed. A download/open link
 * is provided by the page as a universal fallback.
 */
export default function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const cssWidth = Math.min(container.clientWidth || 800, 1000);
        const dpr = window.devicePixelRatio || 1;

        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const scale = (cssWidth / base.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "mb-4 w-full rounded-lg border border-gray-200 bg-white shadow-sm";
          container.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport }).promise;
        }

        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div>
      {status === "loading" && <p className="py-6 text-center text-sm text-gray-500">טוען מסמך…</p>}
      {status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          לא ניתן להציג את הקובץ כאן. נסה לפתוח אותו ישירות בעזרת הכפתור למעלה.
        </p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
