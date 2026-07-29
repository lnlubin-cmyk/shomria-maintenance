import SiteHeader from "@/components/SiteHeader";
import { getCommunityMenu } from "@/lib/community";
import { getVisibleScheduleList } from "@/lib/prayer-times-server";
import { getActiveVotesForMenu } from "@/lib/votes";
import type { Session } from "@/lib/types";

/**
 * Server wrapper around the client SiteHeader: fetches the dynamic menu data
 * (the "קהילה" items, the prayer schedules shown as sub-items, and the currently
 * open vote(s)) so every page's nav reflects the current state without each page
 * fetching it.
 */
export default async function AppHeader({ session }: { session: Session | null }) {
  const [community, prayerSchedules, activeVotes] = session
    ? await Promise.all([getCommunityMenu(), getVisibleScheduleList(), getActiveVotesForMenu()])
    : [[], [], []];
  return (
    <SiteHeader
      session={session}
      community={community}
      prayerSchedules={prayerSchedules}
      activeVotes={activeVotes}
    />
  );
}
