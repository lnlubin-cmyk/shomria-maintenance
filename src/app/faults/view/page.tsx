import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { isStaff } from "@/lib/types";
import { getBuildingFacts } from "@/lib/building-facts";
import FaultDetail from "../FaultDetail";

const FAULT_SELECT = `
  fault_number, caller_resident_id, caller_name, created_by_user_id, building_plot_number, fault_description,
  status, priority, assigned_to_user_id, treatment_description, treatment_type,
  hours_spent, total_cost, closed_at, created_at,
  caller:residents!faults_caller_resident_id_fkey(first_name, last_name, phone),
  building:buildings!faults_building_plot_number_fkey(building_name, layer:building_layers(prefix)),
  assignee:users!faults_assigned_to_user_id_fkey(first_name, last_name, resident:residents(first_name, last_name))
`;

/** View several calls one after another (staff only). Read-only. */
export default async function FaultsMultiViewPage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/faults");
  if (!isStaff(session.user.role)) redirect("/faults");

  const ids = (searchParams.ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  const admin = createAdminClient();

  const details = [];
  for (const n of ids) {
    const { data: fault } = await admin
      .from("faults")
      .select(FAULT_SELECT)
      .eq("fault_number", n)
      .maybeSingle();
    if (!fault) continue;

    const { data: messages } = await admin
      .from("fault_messages")
      .select(
        `id, body, to_phone, sms_ok, is_automatic, created_at,
         sender:users!fault_messages_created_by_user_id_fkey(first_name, last_name, resident:residents(first_name, last_name))`
      )
      .eq("fault_number", n)
      .order("created_at");

    const { data: costItems } = await admin
      .from("fault_cost_items")
      .select("id, description, amount, created_at")
      .eq("fault_number", n)
      .order("created_at");

    const facts = await getBuildingFacts(fault.building_plot_number);

    details.push({ fault, messages: messages ?? [], costItems: costItems ?? [], facts });
  }

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <Link href="/faults" className="text-sm text-brand-600 hover:underline">
            ← חזרה לרשימת הקריאות
          </Link>
          <span className="text-sm text-gray-500">{details.length} קריאות</span>
        </div>

        {details.length === 0 ? (
          <div className="card text-center text-gray-600">לא נמצאו קריאות.</div>
        ) : (
          details.map((d, i) => (
            <div key={d.fault.fault_number} className={i > 0 ? "border-t border-gray-200 pt-8" : ""}>
              <FaultDetail
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                fault={d.fault as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                messages={d.messages as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                costItems={d.costItems as any}
                facts={d.facts}
                workers={[]}
                staff
                mode="view"
                embedded
              />
            </div>
          ))
        )}
      </main>
    </div>
  );
}
