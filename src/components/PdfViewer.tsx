"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF inline by drawing each page to a canvas with PDF.js, and lays a
 * transparent anchor over every link annotation so links in the file are
 * clickable. Works on mobile and desktop (unlike an <iframe> of the PDF).
 *
 * Zoom: the ＋/− controls re-render the pages at a larger scale (crisp, not a
 * blurry CSS stretch). Enlarging this way keeps the page itself at 100%, so it
 * doesn't fight the sticky header the way whole-page pinch-zoom does. The
 * document is fetched once; changing the zoom re-renders without re-downloading.
 *
 * Performance:
 *  - Pages render LAZILY (IntersectionObserver): the first page shows almost
 *    immediately and later pages render only as they scroll into view.
 *  - The canvas pixel ratio is capped (mobile DPR of 3 would render 9× pixels).
 *  - Download progress is shown while the file streams in.
 *
 * cMapUrl + standardFontDataUrl are required for correct text rendering of PDFs
 * that use CID / non-embedded fonts (e.g. Hebrew). The worker, cmaps and fonts
 * are all self-hosted from /public. A download link is offered by the page too.
 */
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

export default function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  const renderToken = useRef(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  // Load the document once per URL.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setProgress(null);

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
          // @font-face engine, which re-shapes Hebrew/RTL runs and mangles the
          // spacing the PDF already positioned. Fixes broken Hebrew.
          disableFontFace: true,
        });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (cancelled || !p.total) return;
          setProgress(Math.min(100, Math.round((p.loaded / p.total) * 100)));
        };

        const pdf = await task.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      pdfRef.current = null;
    };
  }, [url]);

  // (Re)render when the document becomes ready or the zoom changes. Never
  // re-fetches — it draws from the already-loaded document.
  useEffect(() => {
    const pdf = pdfRef.current;
    if (status !== "ready" || !pdf) return;

    const token = ++renderToken.current;
    let observer: IntersectionObserver | null = null;

    (async () => {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      // Fit-to-width is the baseline (zoom 1); higher zooms make pages wider than
      // the viewport, so the wrapper scrolls horizontally.
      const baseWidth = Math.min(container.clientWidth || 800, 1000);
      const cssWidth = baseWidth * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      const first = await pdf.getPage(1);
      if (token !== renderToken.current) return;
      const firstBase = first.getViewport({ scale: 1 });
      const estHeight = (cssWidth / firstBase.width) * firstBase.height;

      const rendered = new Set<number>();

      async function renderPage(n: number, pageDiv: HTMLDivElement) {
        if (token !== renderToken.current || rendered.has(n)) return;
        rendered.add(n);

        const page = n === 1 ? first : await pdf.getPage(n);
        if (token !== renderToken.current) return;

        const base = page.getViewport({ scale: 1 });
        const scale = cssWidth / base.width;
        const cssViewport = page.getViewport({ scale });
        const renderViewport = page.getViewport({ scale: scale * dpr });

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
        if (token !== renderToken.current) return;

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

      // Render the first page right away (don't wait for the observer).
      const firstDiv = container.querySelector<HTMLDivElement>('[data-page="1"]');
      if (firstDiv) renderPage(1, firstDiv);
    })();

    return () => {
      renderToken.current++;
      observer?.disconnect();
    };
  }, [status, zoom]);

  const changeZoom = (dir: 1 | -1) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + dir * ZOOM_STEP) * 100) / 100)));

  return (
    <div>
      {/* Zoom controls at the top (near the "הורד קובץ" button) — enlarge the
          document without whole-page pinch. Kept out of the bottom edge so a
          phone's on-screen nav bar doesn't cover them. */}
      {status === "ready" && (
        <div className="mb-3 flex justify-end">
          <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-1 shadow-sm">
            <button
              type="button"
              aria-label="הקטן"
              onClick={() => changeZoom(-1)}
              disabled={zoom <= ZOOM_MIN}
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-12 text-center text-sm tabular-nums text-gray-600">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              aria-label="הגדל"
              onClick={() => changeZoom(1)}
              disabled={zoom >= ZOOM_MAX}
              className="flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      )}

      {status === "loading" && (
        <p className="py-6 text-center text-sm text-gray-500">
          טוען מסמך{progress != null ? `… ${progress}%` : "…"}
        </p>
      )}
      {status === "error" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          לא ניתן להציג את הקובץ כאן. נסו להוריד אותו בעזרת הכפתור „הורד קובץ” למעלה.
        </p>
      )}

      <div className="overflow-x-auto" dir="ltr">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
