import { redirect } from "next/navigation";
import { getSession, createAdminClient } from "@/lib/supabase/server";
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

  // Consent filtering needs to read every family's share_house, which RLS hides
  // from a regular resident — so compute the visible set server-side with the
  // service role, and return only houses that may be shown. A family building
  // appears if at least one of its residents consented; public buildings (no
  // residents) always appear.
  const admin = createAdminClient();

  const { data } = await admin
    .from("buildings")
    .select(
      "plot_number, building_name, street_name, house_number, itm_x, itm_y, latitude, longitude, layer_id, resident_1, resident_2, resident_3, resident_4, layer:building_layers(name, prefix)"
    )
    .not("itm_x", "is", null)
    .order("building_name");

  const raw = (data ?? []) as unknown as (Building & {
    resident_1: string | null;
    resident_2: string | null;
    resident_3: string | null;
    resident_4: string | null;
  })[];

  const residentIds = [
    ...new Set(
      raw.flatMap((b) => [b.resident_1, b.resident_2, b.resident_3, b.resident_4].filter(Boolean))
    ),
  ] as string[];

  const consent = new Map<string, boolean>();
  if (residentIds.length > 0) {
    const { data: rows } = await admin
      .from("residents")
      .select("id, share_house")
      .in("id", residentIds);
    (rows ?? []).forEach((r) => consent.set(r.id, r.share_house));
  }

  // Keep only consenting buildings, and strip resident links before sending to
  // the client (the map never needs them).
  const buildings = raw
    .filter((b) => {
      const ids = [b.resident_1, b.resident_2, b.resident_3, b.resident_4].filter(Boolean) as string[];
      if (ids.length === 0) return true; // public building
      return ids.some((id) => consent.get(id) === true);
    })
    .map((b) => {
      const stripped = { ...b } as Record<string, unknown>;
      delete stripped.resident_1;
      delete stripped.resident_2;
      delete stripped.resident_3;
      delete stripped.resident_4;
      return stripped as unknown as Building;
    });

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
