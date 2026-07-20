import { redirect } from "next/navigation";
import { getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import MapSpike from "./MapSpike";

/**
 * Map — currently the govmap spike. Registered users only.
 */
export default async function MapPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  const token = process.env.NEXT_PUBLIC_GOVMAP_TOKEN ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader session={session} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">מפת הישוב</h1>
        <p className="mb-6 text-sm text-gray-600">בדיקת חיבור ל-govmap.</p>

        {token ? (
          <MapSpike token={token} />
        ) : (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            חסר טוקן govmap. ודא ש-NEXT_PUBLIC_GOVMAP_TOKEN מוגדר ב-.env.local.
          </div>
        )}
      </main>
    </div>
  );
}
