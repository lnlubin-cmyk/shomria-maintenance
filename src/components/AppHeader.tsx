import SiteHeader from "@/components/SiteHeader";
import { getMenuDocs } from "@/lib/community";
import { momentsExist } from "@/lib/moments";
import { getEventsForMenu } from "@/lib/events";
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
  const [docs, prayerSchedules, activeVotes, hasMoments, events] = session
    ? await Promise.all([
        getMenuDocs(),
        getVisibleScheduleList(),
        getActiveVotesForMenu(),
        momentsExist(),
        getEventsForMenu(),
      ])
    : [{ community: [], info: [], torah: [] }, [], [], false, []];
  return (
    <SiteHeader
      session={session}
      community={docs.community}
      hasMoments={hasMoments}
      events={events}
      infoDocs={docs.info}
      torahDocs={docs.torah}
      prayerSchedules={prayerSchedules}
      activeVotes={activeVotes}
    />
  );
}
