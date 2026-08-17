import SiteHeader from "@/components/SiteHeader";
import { getMenuDocs } from "@/lib/community";
import { getVisibleScheduleList } from "@/lib/prayer-times-server";
import { getActiveVotesForMenu } from "@/lib/votes";
import { getInfoPanels, isPanelConfigured, panelHref } from "@/lib/info-panels";
import type { Session } from "@/lib/types";

/**
 * Server wrapper around the client SiteHeader: fetches the dynamic menu data
 * (the "קהילה" items, the prayer schedules shown as sub-items, and the currently
 * open vote(s)) so every page's nav reflects the current state without each page
 * fetching it.
 */
export default async function AppHeader({ session }: { session: Session | null }) {
  const [docs, prayerSchedules, activeVotes, panels] = session
    ? await Promise.all([getMenuDocs(), getVisibleScheduleList(), getActiveVotesForMenu(), getInfoPanels()])
    : [{ community: [], info: [], torah: [] }, [], [], []];
  const infoPanels = panels
    .filter(isPanelConfigured)
    .map((p) => ({ label: p.menu_label, href: panelHref(p.slug) }));
  return (
    <SiteHeader
      session={session}
      community={docs.community}
      infoDocs={docs.info}
      torahDocs={docs.torah}
      infoPanels={infoPanels}
      prayerSchedules={prayerSchedules}
      activeVotes={activeVotes}
    />
  );
}
