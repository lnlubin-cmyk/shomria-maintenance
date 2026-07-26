import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getTodayHalachicTimes } from "@/lib/halachic";
import AppHeader from "@/components/AppHeader";

export const metadata = { title: "זמנים הלכתיים — קהילת עצמונה-שומריה" };

export default async function HalachicTimesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/halachic-times");

  const t = await getTodayHalachicTimes();

  const gregHe = new Date(`${t.gregorianISO}T12:00:00`).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
              🕰️
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">זמנים הלכתיים</h1>
              <p className="text-sm text-gray-600">שומריה — זמני היום</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white p-4 shadow-soft ring-1 ring-gray-100">
            <p className="text-lg font-semibold text-gray-900">{t.hebrewDateHe}</p>
            <p className="text-sm text-gray-600">{gregHe}</p>
            {t.dayTitle && (
              <p className="mt-1 inline-block rounded-full bg-accent-50 px-2.5 py-0.5 text-sm font-medium text-accent-700">
                {t.dayTitle}
              </p>
            )}
          </div>
        </header>

        {t.times && t.times.length > 0 ? (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {t.times.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="text-gray-700">{item.label}</span>
                <span className="font-semibold tabular-nums text-gray-900" dir="ltr">
                  {item.time}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card text-center text-gray-600">
            לא נמצאו זמנים לתאריך זה. ייתכן שטרם הועלה לוח זמנים לשנה זו.
          </div>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          הזמנים לפי לוח הזמנים השנתי של שומריה. באחריות המשתמש לוודא מול לוח מוסמך.
        </p>
      </main>
    </div>
  );
}
