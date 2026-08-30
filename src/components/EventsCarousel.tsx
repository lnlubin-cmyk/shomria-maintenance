"use client";

import { useCallback, useEffect, useState } from "react";
import RichText from "@/components/RichText";
import type { EventView } from "@/lib/types";

const ADVANCE_MS = 5000;

function formatEventDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return null;
  }
}

function EventCard({ ev }: { ev: EventView }) {
  const date = formatEventDate(ev.eventDate);

  // With a poster image: image fills the card, text over a bottom scrim.
  if (ev.imageUrl) {
    return (
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ev.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          {date && <div className="mb-1 text-sm font-medium text-white/90">{date}</div>}
          <h3 className="text-xl font-bold [text-shadow:0_2px_10px_rgba(0,0,0,.6)]">{ev.title}</h3>
          {ev.body && <RichText value={ev.body} className="mt-1 line-clamp-2 text-sm text-white/90" />}
        </div>
      </div>
    );
  }

  // No image: a branded card.
  return (
    <div className="flex h-full w-full flex-col justify-center bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
      {date && <div className="mb-1 text-sm font-medium text-white/90">{date}</div>}
      <h3 className="text-2xl font-bold">{ev.title}</h3>
      {ev.body && <RichText value={ev.body} className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/90" />}
    </div>
  );
}

/** Auto-advancing (every 5s) carousel of upcoming events. */
export default function EventsCarousel({ events }: { events: EventView[] }) {
  const count = events.length;
  const [index, setIndex] = useState(0);
  const advance = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(advance, ADVANCE_MS);
    return () => clearInterval(t);
  }, [count, advance]);

  if (count === 0) return null;
  const current = Math.min(index, count - 1);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
      {/* Track slides left as the index advances. */}
      <div className="h-56 sm:h-64" dir="ltr">
        <div
          className="flex h-full transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {events.map((ev) => (
            <div key={ev.id} className="h-full w-full shrink-0" dir="rtl">
              <EventCard ev={ev} />
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="הבא"
            onClick={advance}
            className="absolute end-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="הקודם"
            onClick={() => setIndex((i) => (i - 1 + count) % count)}
            className="absolute start-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-lg text-white transition hover:bg-black/60"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-2">
            {events.map((ev, i) => (
              <button
                key={ev.id}
                type="button"
                aria-label={`אירוע ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-5 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
