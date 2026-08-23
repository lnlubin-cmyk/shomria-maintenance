"use client";

import { useState } from "react";
import { withAutoplay } from "@/lib/moments-embed";
import { formatDate } from "@/lib/types";
import type { MomentView } from "@/lib/types";

/** Play triangle over a thumbnail. */
function PlayBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white transition group-hover:bg-black/75">
        <svg viewBox="0 0 24 24" fill="currentColor" className="ms-0.5 h-7 w-7" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * One "רגע שזוכרים": a thumbnail that swaps to the embedded player on click
 * (so a gallery of many videos doesn't load every player at once). A plain
 * external link has no embed — the whole card opens it in a new tab.
 */
export default function MomentCard({ moment }: { moment: MomentView }) {
  const [playing, setPlaying] = useState(false);
  const dateLabel = moment.eventDate ? formatDate(moment.eventDate) : null;

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {moment.embedUrl ? (
          playing ? (
            <iframe
              src={withAutoplay(moment.embedUrl, moment.provider)}
              className="absolute inset-0 h-full w-full"
              title={moment.title || "וידאו"}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 h-full w-full"
              aria-label={`נגן: ${moment.title}`}
            >
              {moment.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={moment.thumb}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <span className="absolute inset-0 bg-gray-800" />
              )}
              <PlayBadge />
            </button>
          )
        ) : (
          <a
            href={moment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-800 text-white transition hover:bg-gray-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
            </svg>
            <span className="text-sm font-medium">פתיחת הקישור</span>
          </a>
        )}
      </div>

      <div className="mt-3">
        <h3 className="font-semibold text-gray-900">{moment.title}</h3>
        {dateLabel && <p className="mt-0.5 text-xs text-gray-500">{dateLabel}</p>}
        {moment.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{moment.description}</p>
        )}
      </div>
    </div>
  );
}
