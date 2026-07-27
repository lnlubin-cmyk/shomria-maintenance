import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { getVisibleScheduleList } from "@/lib/prayer-times-server";
import AppHeader from "@/components/AppHeader";

export const metadata = { title: "זמני תפילות — קהילת עצמונה-שומריה" };

export default async function PrayerTimesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/prayer-times");

  const schedules = await getVisibleScheduleList();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            🙏
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">זמני תפילות</h1>
            <p className="text-sm text-gray-600">בחרו לוח תפילות</p>
          </div>
        </header>

        {schedules.length === 0 ? (
          <div className="card text-center text-gray-600">עדיין לא הוגדרו זמני תפילות.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {schedules.map((s) => (
              <Link
                key={s.id}
                href={`/prayer-times/${s.id}`}
                className="card flex items-center justify-between transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <span className="font-semibold text-gray-900">{s.title}</span>
                <span className="text-brand-500">←</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
