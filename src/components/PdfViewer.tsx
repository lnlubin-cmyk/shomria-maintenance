"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF inline by drawing each page to a canvas with PDF.js, and lays a
 * transparent anchor over every link annotation so links in the file are
 * clickable. Works on mobile and desktop (unlike an <iframe> of the PDF).
 *
 * cMapUrl + standardFontDataUrl are required for correct text rendering of PDFs
 * that use CID / non-embedded fonts (e.g. Hebrew) — without them glyphs are
 * substituted and land in the wrong places. The worker, cmaps and fonts are all
 * self-hosted from /public. A download/open link is offered by the page as a
 * fallback.
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

        const pdf = await pdfjs.getDocument({
          url,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
        }).promise;
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
          const cssScale = cssWidth / base.width;
          const cssViewport = page.getViewport({ scale: cssScale });
          const renderViewport = page.getViewport({ scale: cssScale * dpr });

          const pageDiv = document.createElement("div");
          pageDiv.className = "relative mx-auto mb-4";
          pageDiv.style.width = `${cssViewport.width}px`;
          pageDiv.style.height = `${cssViewport.height}px`;

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          canvas.width = renderViewport.width;
          canvas.height = renderViewport.height;
          canvas.style.width = `${cssViewport.width}px`;
          canvas.style.height = `${cssViewport.height}px`;
          canvas.className = "block rounded-lg border border-gray-200 bg-white shadow-sm";
          pageDiv.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
          if (cancelled) return;

          // Overlay clickable anchors on link annotations (CSS-pixel coords).
          // pdf.js types annotations loosely, so treat each as a bag of fields.
          const annotations = (await page.getAnnotations()) as Array<{
            subtype?: string;
            url?: string;
            rect: number[];
          }>;
          for (const a of annotations) {
            if (a.subtype !== "Link" || !a.url) continue;
            const [x1, y1, x2, y2] = cssViewport.convertToViewportRectangle(a.rect);
            const link = document.createElement("a");
            link.href = a.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.title = a.url;
            link.className = "absolute rounded-sm hover:bg-yellow-300/30";
            link.style.left = `${Math.min(x1, x2)}px`;
            link.style.top = `${Math.min(y1, y2)}px`;
            link.style.width = `${Math.abs(x2 - x1)}px`;
            link.style.height = `${Math.abs(y2 - y1)}px`;
            pageDiv.appendChild(link);
          }

          container.appendChild(pageDiv);
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
