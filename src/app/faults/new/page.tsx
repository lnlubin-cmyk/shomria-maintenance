import { redirect } from "next/navigation";
import { createClient, getSession } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import NewFaultForm from "./NewFaultForm";
import { isStaff, type Building } from "@/lib/types";

export default async function NewFaultPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/faults/new");

  const supabase = createClient();

  const { data: buildings } = await supabase
    .from("buildings")
    .select(
      "plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4, layer_id, latitude, longitude, itm_x, itm_y, layer:building_layers(name, prefix)"
    )
    .order("building_name");

  const list = (buildings ?? []) as unknown as Building[];

  // Staff opening a call may fill in the handling fields immediately, so they
  // need the assignable-worker list for the אחריות dropdown.
  const staff = isStaff(session.user.role);
  const { data: workers } = staff
    ? await supabase
        .from("users")
        .select("id, role, first_name, last_name, resident:residents(first_name, last_name)")
        .in("role", ["maintenance", "maintenance_manager"])
        .eq("is_active", true)
    : { data: [] };

  // Spec 2b: default to the building where this user is registered as a resident.
  // External (non-resident) staff have no home building — they pick one.
  const rid = session.residentId;
  const home = rid
    ? list.find(
        (b) =>
          b.resident_1 === rid || b.resident_2 === rid || b.resident_3 === rid || b.resident_4 === rid
      )
    : undefined;

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">פתיחת קריאה חדשה</h1>
        <p className="mb-6 text-sm text-gray-600">
          מלא את פרטי התקלה. שדות המסומנים ב-* הם חובה.
        </p>

        <NewFaultForm
          buildings={list}
          defaultBuildingPlot={home?.plot_number ?? null}
          currentResidentId={session.residentId}
          currentResidentName={session.residentId ? session.displayName : ""}
          staff={staff}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          workers={(workers ?? []) as any[]}
        />
      </main>
    </div>
  );
}
