"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import InstallButton from "@/components/InstallButton";
import { ROLE_LABELS, isStaff, type Session, type CommunityMenuItem } from "@/lib/types";

type SubItem = { label: string; href: string };
type MenuItem = { label: string; href?: string; soon?: boolean; children?: SubItem[] };
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
export default function SiteHeader({
  session,
  community = [],
  infoDocs = [],
  prayerSchedules = [],
  activeVotes = [],
}: {
  session: Session | null;
  community?: CommunityMenuItem[];
  infoDocs?: CommunityMenuItem[];
  prayerSchedules?: { id: string; title: string }[];
  activeVotes?: { id: string; title: string }[];
}) {
  const staff = session ? isStaff(session.user.role) : false;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Mobile: sections start collapsed and expand on tap (accordion-style).
  const [openMobileSections, setOpenMobileSections] = useState<Set<string>>(new Set());
  const navRef = useRef<HTMLDivElement>(null);

  const toggleMobileSection = (key: string) =>
    setOpenMobileSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // "זמני תפילות" shows the schedules directly as sub-items in the menu (no
  // intermediate list page); falls back to a link if none are defined yet.
  const prayerItem: MenuItem =
    prayerSchedules.length > 0
      ? {
          label: "זמני תפילות",
          children: prayerSchedules.map((s) => ({ label: s.title, href: `/prayer-times/${s.id}` })),
        }
      : { label: "זמני תפילות", href: "/prayer-times" };

  const sections: MenuSection[] = [
    {
      key: "info",
      label: "מידע לתושב",
      items: [
        prayerItem,
        { label: "שיעורי תורה", href: "/torah-lessons" },
        { label: "זמנים הלכתיים", href: "/halachic-times" },
        { label: "קו העירוב", href: "/eruv" },
        { label: "חפש בית בישוב", href: "/map" },
        { label: "חפש מספר טלפון", href: "/phone-directory" },
        // Admin-managed document items assigned to the "מידע לתושב" section.
        ...infoDocs.map((d) => ({ label: d.subject, href: `/community/${d.id}` })),
      ],
    },
    // "קהילה" — dynamic, admin-managed. Only rendered when it has items (each
    // already filtered to visible + has subject + has file).
    ...(community.length > 0
      ? [
          {
            key: "community",
            label: "קהילה",
            items: community.map((c) => ({ label: c.subject, href: `/community/${c.id}` })),
          } as MenuSection,
        ]
      : []),
    {
      key: "yard",
      label: "פנייה לצוות חצר",
      items: [
        { label: "פתיחת קריאה לתקלה", href: "/faults/new" },
        { label: staff ? "ניהול תקלות" : "מעקב סטטוס קריאה", href: "/faults" },
      ],
    },
    // "הצבעות" — the open vote(s) appear at the top when active; the history &
    // results view is always available.
    {
      key: "votes",
      label: "הצבעות",
      items: [
        ...(activeVotes.length > 0
          ? [
              {
                label: "הצבעה פעילה",
                children: activeVotes.map((v) => ({ label: v.title, href: `/votes/${v.id}` })),
              } as MenuItem,
            ]
          : []),
        { label: "הצבעות קודמות ותוצאות", href: "/votes" },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-brown-600 shadow-soft">
      <div ref={navRef} className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setMobileOpen(false)}>
          <span className="rounded-xl bg-white px-3 py-1 shadow-sm">
            <Logo className="h-16 w-auto" />
          </span>
        </Link>

        {/* Desktop nav */}
        {session && (
          <nav className="hidden items-center gap-1 md:flex">
            {sections.map((s) => (
              <div key={s.key} className="relative">
                <button
                  onClick={() => setOpenMenu(openMenu === s.key ? null : s.key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    openMenu === s.key ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  {s.label}
                  <Chevron open={openMenu === s.key} />
                </button>

                {openMenu === s.key && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                    {s.items.map((it) =>
                      it.children ? (
                        <div key={it.label} className="py-1">
                          <div className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                            {it.label}
                          </div>
                          <div className="me-1 ms-3 space-y-0.5 border-s-2 border-brand-100 ps-2">
                            {it.children.map((c) => (
                              <Link
                                key={c.href}
                                href={c.href}
                                onClick={() => setOpenMenu(null)}
                                className="block rounded-lg px-2 py-1.5 text-[13px] text-gray-600 transition hover:bg-brand-50 hover:text-brand-700"
                              >
                                {c.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : it.soon || !it.href ? (
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

            <Link
              href="/contact"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              צור קשר
            </Link>

            <InstallButton variant="desktop" onNavigate={() => setOpenMenu(null)} />

            {session.user.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
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
                className="hidden rounded-lg px-2 py-1 text-left leading-tight text-white hover:bg-white/10 sm:block"
              >
                <div className="text-sm font-medium">{session.displayName}</div>
                <div className="text-xs text-white/70">{ROLE_LABELS[session.user.role]} · פרופיל</div>
              </Link>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  יציאה
                </button>
              </form>

              {/* Mobile hamburger */}
              <button
                type="button"
                aria-label="תפריט"
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10 md:hidden"
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

            {sections.map((s) => {
              const open = openMobileSections.has(s.key);
              return (
                <div key={s.key} className="overflow-hidden rounded-xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleMobileSection(s.key)}
                    className={`flex w-full items-center justify-between px-3 py-3 text-right transition ${
                      open ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <span className="text-base font-bold">{s.label}</span>
                    <Chevron open={open} />
                  </button>
                  {open && (
                    <div className="space-y-0.5 p-1.5">
                      {s.items.map((it) =>
                        it.children ? (
                          <div key={it.label}>
                            <div className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                              {it.label}
                            </div>
                            <div className="me-1 ms-3 space-y-0.5 border-s-2 border-brand-100 ps-2">
                              {it.children.map((c) => (
                                <Link
                                  key={c.href}
                                  href={c.href}
                                  onClick={() => setMobileOpen(false)}
                                  className="block rounded-lg px-2 py-1.5 text-[13px] text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                                >
                                  {c.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : it.soon || !it.href ? (
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
                  )}
                </div>
              );
            })}

            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="block rounded-xl border border-gray-200 bg-gray-100 px-3 py-3 text-base font-bold text-gray-900 hover:bg-gray-200"
            >
              צור קשר
            </Link>

            <InstallButton variant="mobile" onNavigate={() => setMobileOpen(false)} />

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
