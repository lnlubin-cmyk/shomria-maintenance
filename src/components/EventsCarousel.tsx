"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EventView } from "@/lib/types";

const ADVANCE_MS = 3000;
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
  // Loop only when one copy of the strip overflows the viewport; otherwise all
  // cards are already visible and there's nothing to scroll.
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const c = trackRef.current;
    if (!c) return;
    const check = () => {
      const step = (c.firstElementChild?.getBoundingClientRect().width ?? 0) + GAP;
      setLoop(count > 1 && step * count > c.clientWidth + 1);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [count]);

  useEffect(() => {
    if (!loop) return;
    const t = setInterval(() => {
      const c = trackRef.current;
      const first = c?.firstElementChild;
      if (!c || !first) return;
      const step = first.getBoundingClientRect().width + GAP;
      const oneCopy = step * count;
      // Keep shifting left. Once a full copy has passed, rewind by exactly one
      // copy — the two copies are identical, so it's invisible — then carry on
      // in the same direction (no rightward jump back to the start).
      // RTL: scrollLeft is 0 at the start (right) and negative toward the left.
      if (Math.abs(c.scrollLeft) >= oneCopy - 1) c.scrollLeft += oneCopy;
      c.scrollBy({ left: -step, behavior: "smooth" });
    }, ADVANCE_MS);
    return () => clearInterval(t);
  }, [loop, count]);

  if (count === 0) return null;

  // A second copy of the cards is what makes the loop seamless.
  const items = loop ? [...events, ...events] : events;

  return (
    <div
      ref={trackRef}
      className="flex snap-x gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((ev, i) => (
        <EventCard key={`${ev.id}-${i}`} ev={ev} />
      ))}
    </div>
  );
}
