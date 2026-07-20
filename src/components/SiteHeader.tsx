"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ROLE_LABELS, isStaff, type Session } from "@/lib/types";

type MenuItem = { label: string; href?: string; soon?: boolean };
type MenuSection = { key: string; label: string; items: MenuItem[] };

function ComingSoon() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
      בקרוב
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Modern sticky header with dropdown section menus and a mobile panel. */
export default function SiteHeader({ session }: { session: Session | null }) {
  const staff = session ? isStaff(session.user.role) : false;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const sections: MenuSection[] = [
    {
      key: "info",
      label: "מידע לתושב",
      items: [
        { label: "חפש בית בישוב", href: "/map" },
        { label: "חפש מספר טלפון", soon: true },
        { label: "קו העירוב", soon: true },
        { label: "זמני תפילות", soon: true },
      ],
    },
    {
      key: "yard",
      label: "פנייה לצוות חצר",
      items: [
        { label: "פתיחת קריאה לתקלה", href: "/faults/new" },
        { label: staff ? "ניהול תקלות" : "מעקב סטטוס קריאה", href: "/faults" },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 shadow-soft backdrop-blur">
      <div ref={navRef} className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setMobileOpen(false)}>
          <Logo className="h-11 w-auto" />
        </Link>

        {/* Desktop nav */}
        {session && (
          <nav className="hidden items-center gap-1 md:flex">
            {sections.map((s) => (
              <div key={s.key} className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === s.key ? null : s.key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    openMenu === s.key ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {s.label}
                  <Chevron open={openMenu === s.key} />
                </button>

                {openMenu === s.key && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                    {s.items.map((it) =>
                      it.soon || !it.href ? (
                        <div
                          key={it.label}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-400"
                        >
                          {it.label}
                          {it.soon && <ComingSoon />}
                        </div>
                      ) : (
                        <Link
                          key={it.label}
                          href={it.href}
                          onClick={() => setOpenMenu(null)}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-brand-50 hover:text-brand-700"
                        >
                          {it.label}
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}

            {session.user.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                ניהול מערכת
              </Link>
            )}
          </nav>
        )}

        {/* User / actions */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link
                href="/profile"
                className="hidden rounded-lg px-2 py-1 text-left leading-tight hover:bg-gray-100 sm:block"
              >
                <div className="text-sm font-medium">{session.displayName}</div>
                <div className="text-xs text-gray-500">{ROLE_LABELS[session.user.role]} · פרופיל</div>
              </Link>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button type="submit" className="btn-secondary">
                  יציאה
                </button>
              </form>

              {/* Mobile hamburger */}
              <button
                type="button"
                aria-label="תפריט"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 md:hidden"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileOpen ? (
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              כניסה / רישום
            </Link>
          )}
        </div>
      </div>

      {/* Mobile panel */}
      {session && mobileOpen && (
        <div className="border-t border-gray-200 bg-white md:hidden">
          <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <span className="font-medium">{session.displayName}</span>
              <span className="text-gray-500"> · פרופיל</span>
            </Link>

            {sections.map((s) => (
              <div key={s.key}>
                <div className="px-1 pb-1 text-xs font-semibold uppercase text-gray-500">{s.label}</div>
                <div className="space-y-0.5">
                  {s.items.map((it) =>
                    it.soon || !it.href ? (
                      <div
                        key={it.label}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-400"
                      >
                        {it.label}
                        {it.soon && <ComingSoon />}
                      </div>
                    ) : (
                      <Link
                        key={it.label}
                        href={it.href}
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {it.label}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}

            {session.user.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                ניהול מערכת
              </Link>
            )}

            <form action="/auth/signout" method="post">
              <button type="submit" className="btn-secondary w-full">
                יציאה
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
