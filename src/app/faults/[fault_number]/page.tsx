import { notFound, redirect } from "next/navigation";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import { isStaff, canSeeFeedback } from "@/lib/types";
import { getBuildingFacts } from "@/lib/building-facts";
import { isAIConfigured } from "@/lib/ai";
import FaultDetail from "../FaultDetail";

const FAULT_SELECT = `
  fault_number, caller_resident_id, caller_name, created_by_user_id, building_plot_number, fault_description,
  status, priority, assigned_to_user_id, treatment_description, treatment_type,
  hours_spent, total_cost, closed_at, created_at,
  caller:residents!faults_caller_resident_id_fkey(first_name, last_name, phone),
  building:buildings!faults_building_plot_number_fkey(building_name, layer:building_layers(prefix)),
  assignee:users!faults_assigned_to_user_id_fkey(first_name, last_name, resident:residents(first_name, last_name))
`;

export default async function FaultDetailPage({
  params,
  searchParams,
}: {
  params: { fault_number: string };
  searchParams: { view?: string };
}) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/faults/${params.fault_number}`);

  const n = Number(params.fault_number);
  if (!Number.isInteger(n)) notFound();

  const admin = createAdminClient();
  const { data: fault } = await admin
    .from("faults")
    .select(FAULT_SELECT)
    .eq("fault_number", n)
    .maybeSingle();
  if (!fault) notFound();

  const staff = isStaff(session.user.role);
  const canAccess =
    staff ||
    fault.caller_resident_id === session.residentId ||
    fault.created_by_user_id === session.user.id;
  if (!canAccess) redirect("/faults");

  const { data: messages } = await admin
    .from("fault_messages")
    .select(
      `id, body, to_phone, sms_ok, is_automatic, created_at,
       sender:users!fault_messages_created_by_user_id_fkey(first_name, last_name, resident:residents(first_name, last_name))`
    )
    .eq("fault_number", n)
    .order("created_at");

  const costItems = staff
    ? (
        await admin
          .from("fault_cost_items")
          .select("id, description, amount, created_at")
          .eq("fault_number", n)
          .order("created_at")
      ).data ?? []
    : [];

  const workers = staff
    ? (
        await admin
          .from("users")
          .select("id, role, first_name, last_name, resident:residents(first_name, last_name)")
          .in("role", ["maintenance", "maintenance_manager"])
          .eq("is_active", true)
      ).data ?? []
    : [];

  const facts = staff ? await getBuildingFacts(fault.building_plot_number) : [];

  // Resident feedback is visible only to מנהל תחזוקה / admin.
  const showFeedback = canSeeFeedback(session.user.role);
  const feedbackRating = showFeedback
    ? ((
        await admin.from("fault_feedback").select("rating").eq("fault_number", n).maybeSingle()
      ).data?.rating ?? null)
    : null;

  const mode: "edit" | "view" = staff && searchParams.view !== "1" ? "edit" : "view";

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <FaultDetail
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fault={fault as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages={(messages ?? []) as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          costItems={costItems as any}
          facts={facts}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          workers={workers as any}
          staff={staff}
          mode={mode}
          feedbackRating={feedbackRating}
          canSeeFeedback={showFeedback}
          aiConfigured={isAIConfigured()}
        />
      </main>
    </div>
  );
}
