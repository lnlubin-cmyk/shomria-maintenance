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

    const observe = (el: HTMLElement) => {
      if (!el.classList.contains("is-visible")) io.observe(el);
    };
    // querySelectorAll also matches "[data-reveal-group] > *" when `root` itself
    // is the group (its children are descendants of the search root).
    const scan = (root: ParentNode) =>
      root
        .querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-group] > *")
        .forEach(observe);

    // Whatever is already in the DOM.
    scan(document);

    // Content behind a <Suspense> boundary streams in AFTER this effect runs;
    // because `reveal-ready` hides reveal targets until observed, a missed
    // element would stay invisible. Pick up nodes as they're inserted.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches("[data-reveal]")) observe(node);
          if (node.parentElement?.hasAttribute("data-reveal-group")) observe(node);
          scan(node);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
