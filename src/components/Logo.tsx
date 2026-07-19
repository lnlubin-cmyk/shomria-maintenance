"use client";

import { useState } from "react";

/**
 * The community logo. Renders /logo.png; if that file isn't present yet, falls
 * back to a text wordmark so pages never show a broken-image icon.
 *
 * To set the real logo, save the image as: public/logo.png
 */
export default function Logo({ className = "h-10 w-auto" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="text-base font-bold text-brand-700">קהילת אמונה-שומריה</span>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logo.png"
      alt="קהילת אמונה-שומריה"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
