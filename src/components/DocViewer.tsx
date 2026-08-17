"use client";

import PdfViewer from "@/components/PdfViewer";

/**
 * Renders an admin-uploaded document by kind: a PDF goes through PdfViewer
 * (which lazy-loads PDF.js), an image renders as a plain <img> — no PDF.js at
 * all, so image documents are lighter to display.
 */
export default function DocViewer({ url, kind }: { url: string; kind: "pdf" | "image" }) {
  if (kind === "image") {
    // Cap at the image's real size (max-w-full, not w-full): stretching a
    // low-resolution image to the full container width blurs it — text worst of
    // all — especially on high-DPI screens. Shown at native size it stays crisp;
    // the page's "open / download" link gives the full image either way.
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="mx-auto block h-auto max-w-full" />
      </div>
    );
  }
  return <PdfViewer url={url} />;
}
