import { createAdminClient } from "@/lib/supabase/server";

export type MoveHouse = {
  plot_number: string;
  building_name: string;
  occupied: boolean;
};

/** Houses for the "מעבר דירות" tool, with whether they're currently occupied. */
export async function getHousesForMove(): Promise<MoveHouse[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("buildings")
    .select("plot_number, building_name, resident_1, resident_2, resident_3, resident_4")
    .order("building_name");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((b: any) => ({
    plot_number: String(b.plot_number),
    building_name: b.building_name ?? "",
    occupied: !!(b.resident_1 || b.resident_2 || b.resident_3 || b.resident_4),
  }));
}
