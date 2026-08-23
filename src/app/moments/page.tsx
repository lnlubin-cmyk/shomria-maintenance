import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import { getVisibleMoments } from "@/lib/moments";
import AppHeader from "@/components/AppHeader";
import MomentCard from "./MomentCard";

/**
 * "רגעים שזוכרים" — a gallery of historic community-event videos/media, a
 * sub-section of קהילה. Login-gated like the rest of the resident content.
 */
export default async function MomentsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/moments");

  const moments = await getVisibleMoments();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader session={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">רגעים שזוכרים</h1>
          <p className="mt-1 text-sm text-gray-600">רגעים ואירועים היסטוריים מחיי הקהילה.</p>
        </div>

        {moments.length === 0 ? (
          <div className="card text-center text-gray-600">עדיין לא נוספו רגעים.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moments.map((m) => (
              <MomentCard key={m.id} moment={m} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
