import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getSession } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { isStaff, canDeleteFaults, buildingLabel, type FaultRow } from "@/lib/types";
import ResidentFaultList from "./ResidentFaultList";
import StaffFaultTable from "./StaffFaultTable";

const SELECT = `
  fault_number,
  caller_resident_id,
  created_by_user_id,
  building_plot_number,
  fault_description,
  status,
  priority,
  assigned_to_user_id,
  treatment_description,
  treatment_type,
  hours_spent,
  total_cost,
  closed_at,
  created_at,
  caller:residents!faults_caller_resident_id_fkey(first_name, last_name),
  building:buildings!faults_building_plot_number_fkey(building_name, layer:building_layers(prefix)),
  assignee:users!faults_assigned_to_user_id_fkey(first_name, last_name, resident:residents(first_name, last_name))
`;

export default async function FaultsPage({
  searchParams,
}: {
  searchParams: { created?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/faults");

  const supabase = createClient();
  const staff = isStaff(session.user.role);

  // RLS already narrows a resident to their own calls; this is not the security
  // boundary, just the ordering the spec asks for (newest first).
  const { data, error } = await supabase
    .from("faults")
    .select(SELECT)
    .order("created_at", { ascending: false });

  const faults = (data ?? []) as unknown as FaultRow[];

  // Staff need the assignable-worker list for the אחריות dropdown.
  const { data: workers } = staff
    ? await supabase
        .from("users")
        .select("id, role, first_name, last_name, resident:residents(first_name, last_name)")
        .in("role", ["maintenance", "maintenance_manager"])
        .eq("is_active", true)
    : { data: [] };

  // Staff can attach useful [key,value] info to a house; the picker lists houses.
  const { data: buildingRows } = staff
    ? await supabase
        .from("buildings")
        .select("plot_number, building_name, layer:building_layers(prefix)")
        .order("building_name")
    : { data: [] };
  const buildings = (buildingRows ?? []).map((b) => ({
    plot_number: b.plot_number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    label: buildingLabel(b as any),
  }));

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{staff ? "ניהול תקלות" : "הקריאות שלי"}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {staff
                ? "כל הקריאות במערכת, מהחדשה לישנה."
                : "הקריאות שנפתחו על שמך, מהחדשה לישנה."}
            </p>
          </div>
          <Link href="/faults/new" className="btn-primary">
            פתיחת קריאה חדשה
          </Link>
        </div>

        {searchParams.created && (
          <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            הקריאה נקלטה. הסטטוס הנוכחי: התקלה התקבלה במערכת.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            טעינת הקריאות נכשלה. רענן את הדף ונסה שוב.
          </div>
        )}

        {staff ? (
          <StaffFaultTable
            faults={faults}
            canDelete={canDeleteFaults(session.user.role)}
            workers={(workers ?? []) as any[]}
            buildings={buildings}
          />
        ) : (
          <ResidentFaultList faults={faults} />
        )}
      </main>
    </div>
  );
}
