import { redirect } from "next/navigation";
import { createClient, getSession } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import NewFaultForm from "./NewFaultForm";
import type { Building } from "@/lib/types";

export default async function NewFaultPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/faults/new");

  const supabase = createClient();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4")
    .order("building_name");

  const list = (buildings ?? []) as Building[];

  // Spec 2b: default to the building where this user is registered as a resident.
  const rid = session.resident.id;
  const home = list.find(
    (b) => b.resident_1 === rid || b.resident_2 === rid || b.resident_3 === rid || b.resident_4 === rid
  );

  return (
    <div className="min-h-screen">
      <SiteHeader session={session} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">פתיחת קריאה חדשה</h1>
        <p className="mb-6 text-sm text-gray-600">
          מלא את פרטי התקלה. שדות המסומנים ב-* הם חובה.
        </p>

        <NewFaultForm
          buildings={list}
          defaultBuildingPlot={home?.plot_number ?? null}
          currentResidentId={session.resident.id}
          currentResidentName={`${session.resident.first_name} ${session.resident.last_name}`}
        />
      </main>
    </div>
  );
}
