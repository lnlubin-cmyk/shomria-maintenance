import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/supabase/server";
import { getScheduleForView } from "@/lib/prayer-times-server";
import { prayerLabel } from "@/lib/prayer-times";
import AppHeader from "@/components/AppHeader";

export default async function ScheduleViewPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/prayer-times/${params.id}`);

  const schedule = await getScheduleForView(params.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/prayer-times" className="text-sm text-brand-600 hover:underline">
          ← כל לוחות הזמנים
        </Link>

        {!schedule ? (
          <div className="card mt-4 text-center text-gray-600">הלוח אינו זמין.</div>
        ) : (
          <>
            <h1 className="mb-5 mt-3 text-2xl font-bold text-gray-900">{schedule.title}</h1>

            {schedule.prayers.length === 0 ? (
              <div className="card text-center text-gray-600">אין מניינים להצגה בלוח זה.</div>
            ) : (
              <div className="space-y-5">
                {schedule.prayers.map((p, pi) => (
                  <section key={pi} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <h2 className="border-b border-gray-100 bg-gray-50 px-4 py-2 font-semibold text-gray-900">
                      {prayerLabel(p)}
                    </h2>
                    <ul className="divide-y divide-gray-100">
                      {p.minyanim.map((m, mi) => (
                        <li key={mi} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                          <span className="text-gray-800">{m.name}</span>
                          <span className="flex items-baseline gap-3">
                            {m.notes && <span className="text-xs text-gray-500">{m.notes}</span>}
                            <span className="font-semibold tabular-nums text-gray-900" dir="ltr">
                              {m.time}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
