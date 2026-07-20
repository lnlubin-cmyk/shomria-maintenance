import { redirect } from "next/navigation";
import { createClient, getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import MapView from "./MapView";
import type { Building } from "@/lib/types";

/**
 * מפת הישוב — all placed houses, labeled, for any registered user. Search a
 * family or building name to zoom to it, and open navigation to a house.
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams: { plot?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  const supabase = createClient();

  // Only placed buildings (have coordinates). Buildings are readable by every
  // authenticated user via RLS.
  const { data } = await supabase
    .from("buildings")
    .select(
      "plot_number, building_name, street_name, house_number, itm_x, itm_y, latitude, longitude, layer_id, layer:building_layers(name, prefix)"
    )
    .not("itm_x", "is", null)
    .order("building_name");

  const buildings = (data ?? []) as unknown as Building[];

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader session={session} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-bold">מפת הישוב</h1>
        <p className="mb-5 text-sm text-gray-600">
          חיפוש בית לפי שם משפחה או שם מבנה, וניווט אליו.
        </p>
        <MapView buildings={buildings} focusPlot={searchParams.plot ?? null} />
      </main>
    </div>
  );
}
