"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF inline by drawing each page to a canvas with PDF.js, and lays a
 * transparent anchor over every link annotation so links in the file are
 * clickable. Works on mobile and desktop (unlike an <iframe> of the PDF).
 *
 * Performance:
 *  - Pages render LAZILY (IntersectionObserver): the first page shows almost
 *    immediately and later pages render only as they scroll into view, so a
 *    long PDF doesn't freeze the browser rendering everything up front.
 *  - The canvas pixel ratio is capped (mobile DPR of 3 would otherwise render
 *    9× the pixels a page needs).
 *  - Download progress is shown while the file streams in (helps on slow links).
 *
 * cMapUrl + standardFontDataUrl are required for correct text rendering of PDFs
 * that use CID / non-embedded fonts (e.g. Hebrew). The worker, cmaps and fonts
 * are all self-hosted from /public. A download/open link is offered by the page
 * as a fallback.
 */
export default function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const task = pdfjs.getDocument({
          url,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          // Draw glyphs as exact vector paths instead of via the browser's
          // @font-face text engine. The browser re-shapes Hebrew/RTL runs, which
          // mangles the letter spacing the PDF already positioned; path rendering
          // places every glyph exactly where the file says. Fixes broken Hebrew.
          disableFontFace: true,
        });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (cancelled || !p.total) return;
          setProgress(Math.min(100, Math.round((p.loaded / p.total) * 100)));
        };

        const pdf = await task.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        const cssWidth = Math.min(container.clientWidth || 800, 1000);
        // Cap the render resolution: 2× is crisp on any screen; a phone's 3×
        // would render 9× the pixels for no visible benefit and a big slowdown.
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        // Estimate page height from page 1 (documents are usually uniform), so
        // placeholders reserve the right space before a page is rendered.
        const first = await pdf.getPage(1);
        if (cancelled) return;
        const firstBase = first.getViewport({ scale: 1 });
        const estHeight = (cssWidth / firstBase.width) * firstBase.height;

        const rendered = new Set<number>();

        async function renderPage(n: number, pageDiv: HTMLDivElement) {
          if (cancelled || rendered.has(n)) return;
          rendered.add(n);

          const page = n === 1 ? first : await pdf.getPage(n);
          if (cancelled) return;

          const base = page.getViewport({ scale: 1 });
          const scale = cssWidth / base.width;
          const cssViewport = page.getViewport({ scale });
          const renderViewport = page.getViewport({ scale: scale * dpr });

          // Correct the placeholder to this page's real height.
          pageDiv.style.height = `${cssViewport.height}px`;

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          canvas.width = renderViewport.width;
          canvas.height = renderViewport.height;
          canvas.style.width = `${cssViewport.width}px`;
          canvas.style.height = `${cssViewport.height}px`;
          canvas.className = "block rounded-lg border border-gray-200 bg-white shadow-sm";

          pageDiv.innerHTML = ""; // drop the placeholder
          pageDiv.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;
          if (cancelled) return;

          // Overlay clickable anchors on link annotations (CSS-pixel coords).
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
        }

        // Render pages a bit before they enter the viewport for a smooth scroll.
        observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              const el = e.target as HTMLDivElement;
              observer?.unobserve(el);
              renderPage(Number(el.dataset.page), el);
            }
          },
          { rootMargin: "800px 0px" }
        );

        // Build a placeholder for every page (reserves scroll height up front).
        for (let n = 1; n <= pdf.numPages; n++) {
          const pageDiv = document.createElement("div");
          pageDiv.dataset.page = String(n);
          pageDiv.className = "relative mx-auto mb-4";
          pageDiv.style.width = `${cssWidth}px`;
          pageDiv.style.height = `${estHeight}px`;

          const ph = document.createElement("div");
          ph.className =
            "flex h-full w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400";
          ph.textContent = `עמוד ${n}`;
          pageDiv.appendChild(ph);

          container.appendChild(pageDiv);
          observer.observe(pageDiv);
        }

        if (!cancelled) setStatus("ready");

        // Render the first page right away (don't wait for the observer).
        const firstDiv = container.querySelector<HTMLDivElement>('[data-page="1"]');
        if (firstDiv) renderPage(1, firstDiv);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [url]);

  return (
    <div>
      {status === "loading" && (
        <p className="py-6 text-center text-sm text-gray-500">
          טוען מסמך{progress != null ? `… ${progress}%` : "…"}
        </p>
      )}
      {status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          לא ניתן להציג את הקובץ כאן. נסה לפתוח אותו ישירות בעזרת הכפתור למעלה.
        </p>
      )}
      <div ref={containerRef} />
    </div>
  );
}
