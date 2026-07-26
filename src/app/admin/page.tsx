import { redirect } from "next/navigation";
import { getSession, createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import AdminTabs from "./AdminTabs";
import { getAllCommunityItems } from "@/lib/community";
import { getAllHomeMedia } from "@/lib/home-media";
import type { Building, BuildingLayer, Resident } from "@/lib/types";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  // Spec screen 4: admin only.
  if (session.user.role !== "admin") {
    return (
      <div className="min-h-screen">
        <AppHeader session={session} />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">אין גישה</h1>
          <p className="mt-2 text-gray-600">מסך ניהול המערכת פתוח למשתמשי אדמין בלבד.</p>
        </main>
      </div>
    );
  }

  const supabase = createClient();

  const [{ data: residents }, { data: buildings }, { data: users }, { data: layers }] =
    await Promise.all([
      supabase
        .from("residents")
        .select("id, first_name, last_name, phone, email, share_phone, share_house")
        .order("last_name"),
      supabase
        .from("buildings")
        .select(
          "plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4, layer_id, latitude, longitude, itm_x, itm_y, layer:building_layers(name, prefix)"
        )
        .order("plot_number"),
      supabase
        .from("users")
        .select("id, resident_id, role, first_name, last_name, email, phone, is_active, resident:residents(first_name, last_name)")
        .order("role"),
      supabase.from("building_layers").select("id, name, prefix, sort_order").order("sort_order"),
    ]);

  const [community, homeMedia] = await Promise.all([getAllCommunityItems(), getAllHomeMedia()]);

  return (
    <div className="min-h-screen">
      <AppHeader session={session} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-bold">ניהול מערכת</h1>
        <p className="mb-6 text-sm text-gray-600">ניהול משתמשים, תושבים ומבנים.</p>

        <AdminTabs
          residents={(residents ?? []) as Resident[]}
          buildings={(buildings ?? []) as unknown as Building[]}
          users={(users ?? []) as any[]}
          layers={(layers ?? []) as BuildingLayer[]}
          community={community}
          homeMedia={homeMedia}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}
