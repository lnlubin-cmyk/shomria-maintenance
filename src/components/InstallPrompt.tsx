"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// New key (was "pwa-install-dismissed", a permanent flag) — bumping it resets any
// prior permanent dismissals, and now it only snoozes for a while.
const SNOOZE_KEY = "pwa-install-snooze";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // re-offer after 14 days

// Capture beforeinstallprompt as soon as this client chunk loads, so we don't
// miss it if it fires before the component mounts.
let captured: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    captured = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("pwa-installable"));
  });
}

/**
 * Dismissible "install app" banner. Shows a real install button where the
 * browser supports it (Android Chrome + desktop Chrome/Edge), or iOS Safari
 * instructions otherwise. Hidden when already installed, on the login screen, or
 * while snoozed.
 */
export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) {
      setDismissed(true);
      return; // already installed
    }
    try {
      const ts = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (ts && Date.now() - ts < SNOOZE_MS) {
        setDismissed(true);
        return; // snoozed
      }
    } catch {
      /* storage blocked — still show */
    }

    if (captured) setDeferred(captured); // event fired before mount

    const onInstallable = () => captured && setDeferred(captured);
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
      try {
        localStorage.setItem(SNOOZE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
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

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setDismissed(true);
  }

  const show = !dismissed && (deferred || iosHint) && !pathname?.startsWith("/login");
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-gray-900">התקינו את אפליקציית שומריה</p>
          {iosHint && !deferred ? (
            <p className="text-gray-600">בספארי: לחצו על כפתור השיתוף ואז „הוסף למסך הבית”.</p>
          ) : (
            <p className="text-gray-600">גישה מהירה ממסך הבית, כמו אפליקציה.</p>
          )}
        </div>
        {deferred && (
          <button type="button" onClick={install} className="btn-primary shrink-0">
            התקנה
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגור"
          className="shrink-0 rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
