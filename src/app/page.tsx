import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import { isStaff } from "@/lib/types";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div className="min-h-screen">
      <SiteHeader session={session} />

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <Logo className="mb-6 h-24 w-auto" />
            <h1 className="text-4xl font-bold leading-tight text-gray-900">
              מערכת ניהול תחזוקה
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              דיווח על תקלות במבני הישוב ומעקב אחר הטיפול בהן — במקום אחד.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {session ? (
                <>
                  <Link href="/faults/new" className="btn-primary">
                    פתיחת קריאה לתקלה
                  </Link>
                  <Link href="/faults" className="btn-secondary">
                    {isStaff(session.user.role) ? "ניהול תקלות" : "בדיקת סטטוס קריאה"}
                  </Link>
                  {session.user.role === "admin" && (
                    <Link href="/admin" className="btn-secondary">
                      ניהול מערכת
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-primary">
                    כניסה / רישום
                  </Link>
                  <p className="w-full text-sm text-gray-500">
                    לפתיחת קריאה יש להיכנס למערכת. הכניסה מותרת לחברי הישוב בלבד.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Image
              src="/hero.svg"
              alt="איור של מבני הקיבוץ"
              width={800}
              height={450}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { title: "פתיחת קריאה", body: "דווח על תקלה במבנה בתוך פחות מדקה." },
            { title: "מעקב סטטוס", body: "עקוב אחר הטיפול מרגע הפתיחה ועד לסגירה." },
            { title: "טיפול מסודר", body: "צוות התחזוקה רואה את כל הקריאות ומטפל לפי סדר." },
          ].map((c) => (
            <div key={c.title} className="card">
              <h2 className="font-semibold text-gray-900">{c.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{c.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        קהילת אמונה-שומריה — מערכת ניהול תחזוקה
      </footer>
    </div>
  );
}
