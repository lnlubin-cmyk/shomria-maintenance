import { redirect } from "next/navigation";
import { getSession, createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/SiteHeader";
import AdminTabs from "./AdminTabs";
import type { Building, Resident } from "@/lib/types";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  // Spec screen 4: admin only.
  if (session.user.role !== "admin") {
    return (
      <div className="min-h-screen">
        <SiteHeader session={session} />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">אין גישה</h1>
          <p className="mt-2 text-gray-600">מסך ניהול המערכת פתוח למשתמשי אדמין בלבד.</p>
        </main>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: residents }, { data: buildings }, { data: users }] = await Promise.all([
    supabase.from("residents").select("id, first_name, last_name, phone, email").order("last_name"),
    supabase
      .from("buildings")
      .select("plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4")
      .order("plot_number"),
    supabase
      .from("users")
      .select("id, resident_id, role, first_name, last_name, email, phone, is_active, resident:residents(first_name, last_name)")
      .order("role"),
  ]);

  return (
    <div className="min-h-screen">
      <SiteHeader session={session} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">ניהול מערכת</h1>
        <p className="mb-6 text-sm text-gray-600">ניהול משתמשים, תושבים ומבנים.</p>

        <AdminTabs
          residents={(residents ?? []) as Resident[]}
          buildings={(buildings ?? []) as Building[]}
          users={(users ?? []) as any[]}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}
