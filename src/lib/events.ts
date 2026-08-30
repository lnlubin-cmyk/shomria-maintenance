import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { notExpired, israelToday } from "@/lib/expiry";
import type { CommunityEvent, EventView } from "@/lib/types";

// Cached signed URL for an event image (same approach as community docs: valid
// 30 days, reused for an hour so the browser caches the image).
const getSignedImageUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
    return data?.signedUrl ?? null;
  },
  ["event-image-url-30d"],
  { revalidate: 60 * 60 }
);

async function resolveEvent(e: CommunityEvent): Promise<EventView> {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    eventDate: e.event_date,
    imageUrl: e.image_path ? await getSignedImageUrl(e.image_path) : null,
  };
}

/** Active events for the home-page carousel: visible, titled, not expired. */
export async function getActiveEvents(): Promise<EventView[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_events")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order")
    .order("event_date")
    .order("created_at");

  const today = israelToday();
  const rows = ((data ?? []) as CommunityEvent[]).filter(
    (e) => e.title.trim() !== "" && notExpired(e.expires_at, today)
  );
  return Promise.all(rows.map(resolveEvent));
}

/** All events (visible + hidden + expired) for the admin tab, in display order. */
export async function getAllEvents(): Promise<CommunityEvent[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_events")
    .select("*")
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as CommunityEvent[];
}

/** Admin list with each event's image resolved to a signed URL for preview. */
export async function getAllEventsForAdmin(): Promise<(CommunityEvent & { imageUrl: string | null })[]> {
  const events = await getAllEvents();
  return Promise.all(
    events.map(async (e) => ({ ...e, imageUrl: e.image_path ? await getSignedImageUrl(e.image_path) : null }))
  );
}
