"use client";

import PdfViewer from "@/components/PdfViewer";

/**
 * Renders an admin-uploaded document by kind: a PDF goes through PdfViewer
 * (which lazy-loads PDF.js), an image renders as a plain <img> — no PDF.js at
 * all, so image documents are lighter to display.
 */
export default function DocViewer({ url, kind }: { url: string; kind: "pdf" | "image" }) {
  if (kind === "image") {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="mx-auto block h-auto w-full" />
      </div>
    );
  }
  return <PdfViewer url={url} />;
}
