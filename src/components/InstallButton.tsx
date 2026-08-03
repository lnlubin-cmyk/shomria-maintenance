"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capture beforeinstallprompt as soon as this client chunk loads, so we don't
// miss it if it fires before the component mounts. (The header renders on every
// page, so this runs early.)
let captured: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    captured = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pwa-installable"));
  });
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/**
 * "Install app" entry for the header menu. Renders nothing unless the app is
 * actually installable and not already installed — so it never covers page
 * content. Where the browser supports it (Android/desktop Chrome & Edge) it
 * triggers the native install prompt; on iOS Safari it reveals the
 * add-to-home-screen instructions inline.
 */
export default function InstallButton({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) {
      setInstalled(true);
      return; // already installed
    }

    if (captured) setDeferred(captured); // event fired before mount

    const onInstallable = () => captured && setDeferred(captured);
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("pwa-installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|android|chrome|edg/i.test(ua);
    if (isIOS && isSafari) setIosHint(true);

    return () => {
      window.removeEventListener("pwa-installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  const installable = !!deferred || iosHint;
  if (!installable) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      onNavigate?.();
      return;
    }
    // iOS Safari: no programmatic prompt — reveal the manual instructions.
    setShowHint((v) => !v);
  }

  const iosText = "בספארי: לחצו על כפתור השיתוף ואז „הוסף למסך הבית”.";

  if (variant === "mobile") {
    return (
      <div>
        <button
          type="button"
          onClick={handleClick}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          <DownloadIcon />
          התקנת האפליקציה
        </button>
        {iosHint && !deferred && showHint && (
          <p className="mx-3 mt-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{iosText}</p>
        )}
      </div>
    );
  }

  // Desktop: a top-level nav button, with the iOS hint in a small popover.
  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
      >
        <DownloadIcon />
        התקנת האפליקציה
      </button>
      {iosHint && !deferred && showHint && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-lg">
          {iosText}
        </div>
      )}
    </div>
  );
}
