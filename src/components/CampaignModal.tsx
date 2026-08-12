"use client";

import { useEffect, useState } from "react";
import type { ActiveCampaign } from "@/lib/types";

/**
 * Shows the active campaign poster once, on first entry to the home page.
 * "Seen" is remembered per device (localStorage), keyed by the campaign id — so
 * a new campaign shows again once. Optional "לפרטים הקש כאן" link: internal
 * paths ("/…") route logged-out users through login first; external links open
 * in a new tab.
 */
export default function CampaignModal({
  campaign,
  loggedIn,
}: {
  campaign: ActiveCampaign;
  loggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const key = `campaign-seen-${campaign.id}`;

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      setOpen(true); // storage blocked — still show it
    }
  }, [key]);

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
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
