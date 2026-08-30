"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { EventView } from "@/lib/types";

const ADVANCE_MS = 5000;
const GAP = 16; // matches gap-4

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

/** A small clickable event card that links to the event's full page. */
function EventCard({ ev }: { ev: EventView }) {
  const date = formatEventDate(ev.eventDate);
  return (
    <Link href={`/events/${ev.id}`} className="group block w-56 shrink-0 snap-start sm:w-64">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700">
          {ev.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ev.imageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-3 text-center text-lg font-bold text-white">
              {ev.title}
            </div>
          )}
        </div>
        <div className="p-3">
          {date && <div className="text-xs font-medium text-accent-600">{date}</div>}
          <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900">{ev.title}</h3>
        </div>
      </div>
    </Link>
  );
}

/** A strip of small event cards that auto-advances (shifts left) every 5s. */
export default function EventsCarousel({ events }: { events: EventView[] }) {
  const count = events.length;
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => {
      const c = trackRef.current;
      if (!c) return;
      const step = (c.firstElementChild?.getBoundingClientRect().width ?? c.clientWidth) + GAP;
      // RTL: scrollLeft is 0 at the start (right) and negative toward the end (left).
      const reachedEnd = Math.abs(c.scrollLeft) + c.clientWidth >= c.scrollWidth - 8;
      c.scrollBy({ left: reachedEnd ? Math.abs(c.scrollLeft) : -step, behavior: "smooth" });
    }, ADVANCE_MS);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  return (
    <div
      ref={trackRef}
      className="flex snap-x gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {events.map((ev) => (
        <EventCard key={ev.id} ev={ev} />
      ))}
    </div>
  );
}
