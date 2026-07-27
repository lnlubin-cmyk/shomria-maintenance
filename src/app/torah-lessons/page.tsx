import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getVisibleLessons } from "@/lib/torah-lessons";
import AppHeader from "@/components/AppHeader";

export const metadata = { title: "שיעורי תורה — קהילת עצמונה-שומריה" };

export default async function TorahLessonsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/torah-lessons");

  const lessons = await getVisibleLessons();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-2xl text-accent-600">
            📖
          </span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">שיעורי תורה</h1>
            <p className="text-sm text-gray-600">שיעורי התורה בישוב</p>
          </div>
        </header>

        {lessons.length === 0 ? (
          <div className="card text-center text-gray-600">עדיין לא הוגדרו שיעורי תורה.</div>
        ) : (
          <ul className="space-y-3">
            {lessons.map((l) => (
              <li key={l.id} className="card">
                <h2 className="font-semibold text-gray-900">{l.subject}</h2>
                <dl className="mt-1 space-y-0.5 text-sm text-gray-600">
                  {l.lecturer && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500">מעביר השיעור:</dt>
                      <dd>{l.lecturer}</dd>
                    </div>
                  )}
                  {l.occurrence && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500">מועד:</dt>
                      <dd>{l.occurrence}</dd>
                    </div>
                  )}
                  {l.hour && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500">שעה:</dt>
                      <dd dir="ltr">{l.hour}</dd>
                    </div>
                  )}
                  {l.notes && (
                    <div className="flex gap-2">
                      <dt className="text-gray-500">הערות:</dt>
                      <dd className="whitespace-pre-line">{l.notes}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
