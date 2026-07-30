import { createAdminClient } from "@/lib/supabase/server";
import type { BuildingFact } from "@/lib/types";

/** The [key, value] notes staff keep for a house, oldest first. Staff-only data. */
export async function getBuildingFacts(plotNumber: string | null): Promise<BuildingFact[]> {
  if (!plotNumber) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("building_facts")
    .select("id, key, value, created_at")
    .eq("plot_number", plotNumber)
    .order("created_at");
  return (data ?? []) as BuildingFact[];
}
