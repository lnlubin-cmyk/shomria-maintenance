import SiteHeader from "@/components/SiteHeader";
import { getMenuDocs } from "@/lib/community";
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
  const [docs, prayerSchedules, activeVotes] = session
    ? await Promise.all([getMenuDocs(), getVisibleScheduleList(), getActiveVotesForMenu()])
    : [{ community: [], info: [] }, [], []];
  return (
    <SiteHeader
      session={session}
      community={docs.community}
      infoDocs={docs.info}
      prayerSchedules={prayerSchedules}
      activeVotes={activeVotes}
    />
  );
}
