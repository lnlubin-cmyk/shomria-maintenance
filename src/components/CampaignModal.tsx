"use client";

import { useEffect, useState } from "react";
import type { ActiveCampaign } from "@/lib/types";

/**
 * Shows the active campaign poster on entry to the home page. How often it
 * re-shows is remembered per device (localStorage), keyed by the campaign id:
 *  - "once"  → shown a single time (until a new campaign replaces it);
 *  - "daily" → shown again once each new day.
 * Optional "לפרטים הקש כאן" link: internal paths ("/…") route logged-out users
 * through login first; external links open in a new tab.
 */

/** Today's date as a local YYYY-M-D string, used as the per-day "seen" marker. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function CampaignModal({
  campaign,
  loggedIn,
}: {
  campaign: ActiveCampaign;
  loggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const key = `campaign-seen-${campaign.id}`;
  // "once" stores "1"; "daily" stores today's date and re-shows on a new day.
  const marker = campaign.frequency === "daily" ? todayKey() : "1";

  useEffect(() => {
    try {
      if (localStorage.getItem(key) !== marker) setOpen(true);
    } catch {
      setOpen(true); // storage blocked — still show it
    }
  }, [key, marker]);

  function dismiss() {
    try {
      localStorage.setItem(key, marker);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const link = campaign.linkUrl?.trim() || null;
  const isInternal = !!link && link.startsWith("/");
  const external = !!link && !isInternal;
  const href = isInternal
    ? loggedIn
      ? link!
      : `/login?next=${encodeURIComponent(link!)}`
    : link ?? "#";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={campaign.imageUrl}
          alt={campaign.title || "קמפיין"}
          className="max-h-[74vh] w-full object-contain"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4">
          <button type="button" onClick={dismiss} className="btn-secondary">
            דלג לאתר
          </button>
          {link && (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              onClick={dismiss}
              className="btn-primary"
            >
              לפרטים הקש כאן
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="סגור"
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
