import { redirect } from "next/navigation";
import { getSession, createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import AdminTabs from "./AdminTabs";
import GabbaiTabs from "./GabbaiTabs";
import { getAllCommunityItems } from "@/lib/community";
import { getAllMoments } from "@/lib/moments";
import { getAllEventsForAdmin } from "@/lib/events";
import { getAllHomeMedia } from "@/lib/home-media";
import { getLoadedHalachicYears } from "@/lib/halachic";
import { getAllSchedules } from "@/lib/prayer-times-server";
import { getAllLessons } from "@/lib/torah-lessons";
import { getAllContacts } from "@/lib/contacts";
import { getAllCampaigns } from "@/lib/campaigns";
import { getHousesForMove } from "@/lib/houses";
import { getAdminVotes } from "@/lib/votes";
import { getInfoPanels } from "@/lib/info-panels";
import { isAIConfigured } from "@/lib/ai";
import type { Building, BuildingLayer, Resident } from "@/lib/types";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");

  const role = session.user.role;

  // Only admins and gabbaim reach the management screen.
  if (role !== "admin" && role !== "gabbai") {
    return (
      <div className="min-h-screen">
        <AppHeader session={session} />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">אין גישה</h1>
          <p className="mt-2 text-gray-600">מסך הניהול פתוח למשתמשים מורשים בלבד.</p>
        </main>
      </div>
    );
  }

  // גבאי — a limited view scoped to the religious content only. Fetch just that
  // data (no residents/users/etc. are loaded for a gabbai).
  if (role === "gabbai") {
    const [schedules, lessons, halachicYears] = await Promise.all([
      getAllSchedules(),
      getAllLessons(),
      getLoadedHalachicYears(),
    ]);
    return (
      <div className="min-h-screen">
        <AppHeader session={session} />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="mb-1 text-2xl font-bold">ניהול תורה ותפילה</h1>
          <p className="mb-6 text-sm text-gray-600">עדכון זמני תפילות, שיעורי תורה וזמנים הלכתיים.</p>
          <GabbaiTabs schedules={schedules} lessons={lessons} halachicYears={halachicYears} />
        </main>
      </div>
    );
  }

  const supabase = createClient();

  // All of the admin datasets are independent, so fetch them in one parallel
  // batch rather than two sequential ones (one round trip instead of two).
  const [
    { data: residents },
    { data: buildings },
    { data: users },
    { data: layers },
    community,
    moments,
    events,
    homeMedia,
    halachicYears,
    schedules,
    lessons,
    contacts,
    campaigns,
    moveHouses,
    votes,
    panels,
  ] = await Promise.all([
    supabase
      .from("residents")
      .select("id, first_name, last_name, phone, email, share_phone, share_house, is_member")
      .order("last_name"),
    supabase
      .from("buildings")
      .select(
        "plot_number, street_name, house_number, building_name, resident_1, resident_2, resident_3, resident_4, water_heater_type, layer_id, latitude, longitude, itm_x, itm_y, layer:building_layers(name, prefix)"
      )
      .order("plot_number"),
    supabase
      .from("users")
      .select("id, resident_id, role, first_name, last_name, email, phone, is_active, resident:residents(first_name, last_name, is_member)")
      .order("role"),
    supabase.from("building_layers").select("id, name, prefix, sort_order").order("sort_order"),
    getAllCommunityItems(),
    getAllMoments(),
    getAllEventsForAdmin(),
    getAllHomeMedia(),
    getLoadedHalachicYears(),
    getAllSchedules(),
    getAllLessons(),
    getAllContacts(),
    getAllCampaigns(),
    getHousesForMove(),
    getAdminVotes(),
    getInfoPanels(),
  ]);

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
          moments={moments}
          events={events}
          homeMedia={homeMedia}
          halachicYears={halachicYears}
          schedules={schedules}
          lessons={lessons}
          contacts={contacts}
          campaigns={campaigns}
          moveHouses={moveHouses}
          votes={votes}
          currentUserId={session.user.id}
          aiConfigured={isAIConfigured()}
          panels={panels}
        />
      </main>
    </div>
  );
}
