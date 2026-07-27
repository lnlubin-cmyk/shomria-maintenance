import SiteHeader from "@/components/SiteHeader";
import { getCommunityMenu } from "@/lib/community";
import { getVisibleScheduleList } from "@/lib/prayer-times-server";
import type { Session } from "@/lib/types";

/**
 * Server wrapper around the client SiteHeader: fetches the dynamic menu data
 * (the "קהילה" items and the prayer schedules shown as sub-items) so every
 * page's nav reflects the current admin-managed lists without each page
 * fetching it.
 */
export default async function AppHeader({ session }: { session: Session | null }) {
  const community = session ? await getCommunityMenu() : [];
  const prayerSchedules = session ? await getVisibleScheduleList() : [];
  return <SiteHeader session={session} community={community} prayerSchedules={prayerSchedules} />;
}
