"use client";

import { useCallback, useEffect, useState } from "react";
import type { HomeMediaItem } from "@/lib/types";

const IMAGE_MS = 6000; // how long each image is shown before advancing

/**
 * Home-page hero carousel. Plays the active media one after another: images for
 * a fixed time, videos until they end. Videos autoplay muted (browser policy).
 * Arrows + dots let the visitor navigate. Renders nothing if there's no media
 * (the page falls back to a static image).
 */
export default function HeroCarousel({ items }: { items: HomeMediaItem[] }) {
  const count = items.length;
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  // Images auto-advance on a timer; videos advance on their 'ended' event.
  useEffect(() => {
    if (count <= 1) return;
    if (items[index]?.kind !== "image") return;
    const t = setTimeout(advance, IMAGE_MS);
    return () => clearTimeout(t);
  }, [index, count, items, advance]);

  if (count === 0) return null;
  const cur = items[index];

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-soft">
      {cur.kind === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={cur.id}
          src={cur.url}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          loop={count === 1}
          onEnded={count > 1 ? advance : undefined}
          onError={count > 1 ? advance : undefined}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={cur.id} src={cur.url} alt="" className="h-full w-full object-cover" />
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="הקודם"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ›
          </button>
          <button
            type="button"
            aria-label="הבא"
            onClick={advance}
            className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ‹
          </button>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {items.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-label={`מדיה ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
