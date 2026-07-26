"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

/**
 * Dismissible "install app" banner. Shows a real install button where the
 * browser fires beforeinstallprompt (Android Chrome + desktop Chrome/Edge on
 * Windows/Mac/Linux), or iOS Safari instructions otherwise. Hidden when already
 * installed or previously dismissed.
 */
export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return; // already installed
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage blocked — still show */
    }

    const ua = navigator.userAgent;
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|android|chrome|edg/i.test(ua);

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    function onInstalled() {
      setHidden(true);
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — offer manual instructions.
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  }

  // Don't cover the login/registration form.
  if (hidden || pathname?.startsWith("/login")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-gray-900">התקינו את אפליקציית שומריה</p>
          {iosHint ? (
            <p className="text-gray-600">
              בספארי: לחצו על כפתור השיתוף ואז „הוסף למסך הבית”.
            </p>
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
