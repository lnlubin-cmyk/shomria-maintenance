import Link from "next/link";
import { ROLE_LABELS, isStaff, type Session } from "@/lib/types";

/** Shared header. The menu adapts to the signed-in user's role (spec, screen 1). */
export default function SiteHeader({ session }: { session: Session | null }) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
            ש
          </span>
          <span className="text-base font-bold text-gray-900">קיבוץ שומריה</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {session && (
            <>
              <Link href="/faults/new" className="rounded-lg px-3 py-2 hover:bg-gray-100">
                פתיחת קריאה
              </Link>
              <Link href="/faults" className="rounded-lg px-3 py-2 hover:bg-gray-100">
                {isStaff(session.user.role) ? "ניהול תקלות" : "הקריאות שלי"}
              </Link>
              {session.user.role === "admin" && (
                <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-gray-100">
                  ניהול מערכת
                </Link>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium leading-tight">
                  {session.displayName}
                </div>
                <div className="text-xs leading-tight text-gray-500">
                  {ROLE_LABELS[session.user.role]}
                </div>
              </div>
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-secondary">
                  יציאה
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-primary">
              כניסה / רישום
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
