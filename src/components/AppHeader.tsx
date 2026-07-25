import SiteHeader from "@/components/SiteHeader";
import { getCommunityMenu } from "@/lib/community";
import type { Session } from "@/lib/types";

/**
 * Server wrapper around the client SiteHeader: fetches the dynamic "קהילה" menu
 * items (visible + complete) and passes them in, so every page's nav reflects
 * the current admin-managed list without each page fetching it.
 */
export default async function AppHeader({ session }: { session: Session | null }) {
  const community = session ? await getCommunityMenu() : [];
  return <SiteHeader session={session} community={community} />;
}
