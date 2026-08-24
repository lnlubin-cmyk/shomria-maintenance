"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeMediaItem } from "@/lib/types";

const IMAGE_MS = 6000; // how long each image is shown before advancing

// Load the YouTube IFrame API once, so we can detect when a video ends.
let ytApi: Promise<unknown> | null = null;
function loadYouTubeApi(): Promise<unknown> {
  if (typeof window === "undefined") return Promise.reject();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!ytApi) {
    ytApi = new Promise((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(w.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    });
  }
  return ytApi;
}

/**
 * Build a privacy-enhanced (youtube-nocookie) embed URL. We deliberately do NOT
 * use YouTube's own loop (loop=1&playlist=<id>): on the nocookie domain that
 * bounces through google.com's consent pages when the clip ends and throws
 * ERR_TOO_MANY_REDIRECTS. Instead we always attach the IFrame API and restart /
 * advance ourselves on the ENDED event.
 */
function ytEmbedUrl(id: string): string {
  const p = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
    enablejsapi: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}

/**
 * Home-page hero carousel. Plays the active media one after another: images for
 * a fixed time, uploaded videos until they end, and YouTube videos until they
 * end (via the IFrame API). Videos autoplay muted (browser policy). Arrows +
 * dots let the visitor navigate. Renders nothing if there's no media.
 */
export default function HeroCarousel({
  items,
  heightClass = "aspect-video",
  bare = false,
}: {
  items: HomeMediaItem[];
  /** Height of the media band. Defaults to a 16:9 box; pass fixed heights for a wide hero. */
  heightClass?: string;
  /** When true, drop the card chrome (border/rounding/shadow) so a parent can frame it. */
  bare?: boolean;
}) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const ytIframeRef = useRef<HTMLIFrameElement>(null);

  const advance = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const cur = items[index];

  // Images auto-advance on a timer (uploaded videos use their 'ended' event).
  useEffect(() => {
    if (count <= 1 || cur?.kind !== "image") return;
    const t = setTimeout(advance, IMAGE_MS);
    return () => clearTimeout(t);
  }, [index, count, cur, advance]);

  // YouTube: when the clip ends, advance to the next item (or restart it if it's
  // the only one) via the IFrame API — never YouTube's own loop, which redirects.
  useEffect(() => {
    if (cur?.kind !== "youtube" || !cur.youtubeId) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any;
    loadYouTubeApi()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((YT: any) => {
        if (cancelled || !ytIframeRef.current) return;
        player = new YT.Player(ytIframeRef.current, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          events: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onStateChange: (e: any) => {
              if (e.data !== YT.PlayerState.ENDED) return;
              if (count > 1) {
                advance();
              } else {
                try {
                  player.seekTo(0);
                  player.playVideo();
                } catch {
                  /* player gone */
                }
              }
            },
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      try {
        player?.destroy();
      } catch {
        /* iframe already gone */
      }
    };
  }, [index, count, cur, advance]);

  if (count === 0 || !cur) return null;

  return (
    <div
      className={`relative ${heightClass} w-full overflow-hidden bg-black ${
        bare ? "" : "rounded-2xl border border-gray-200 shadow-soft"
      }`}
    >
      {cur.kind === "youtube" ? (
        <iframe
          key={cur.id}
          ref={ytIframeRef}
          src={ytEmbedUrl(cur.youtubeId ?? "")}
          className="h-full w-full"
          title="וידאו"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : cur.kind === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          key={cur.id}
          src={cur.url}
          poster={cur.poster}
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
        <img key={cur.id} src={cur.url} alt="" className="animate-kenburns h-full w-full object-cover" />
      )}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="הקודם"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ›
          </button>
          <button
            type="button"
            aria-label="הבא"
            onClick={advance}
            className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ‹
          </button>

          <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-2">
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
