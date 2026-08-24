"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Reveals elements marked with `data-reveal` (or the direct children of a
 * `data-reveal-group`) as they scroll into view, adding `.is-visible`. Grid
 * children get a small staggered delay so a row cascades in.
 *
 * The elements are hidden by CSS only under `html.reveal-ready`, which an inline
 * <head> script sets before first paint (and only when motion is allowed) — so
 * there's no flash and no-JS / reduced-motion users always see the content.
 * Re-runs on navigation because the root layout (and this effect) persist across
 * client-side route changes.
 */
export default function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("reveal-ready");

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group] > *")
    ).filter((el) => !el.classList.contains("is-visible"));
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const parent = el.parentElement;
          if (parent?.hasAttribute("data-reveal-group")) {
            const idx = Array.from(parent.children).indexOf(el);
            el.style.transitionDelay = `${Math.min(Math.max(idx, 0), 8) * 55}ms`;
          }
          el.classList.add("is-visible");
          obs.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
