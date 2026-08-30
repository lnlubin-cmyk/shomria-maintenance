import { unstable_cache } from "next/cache";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { COMMUNITY_BUCKET } from "@/lib/community";
import { docKind } from "@/lib/doc-files";
import { notExpired, israelToday } from "@/lib/expiry";
import type { CommunityEvent, EventView } from "@/lib/types";

// Cached signed URL for an event asset (image or PDF): valid 30 days, reused for
// an hour so the browser caches it — same approach as community docs.
const getSignedUrl = unstable_cache(
  async (path: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(COMMUNITY_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
    return data?.signedUrl ?? null;
  },
  ["event-asset-url-30d"],
  { revalidate: 60 * 60 }
);

// Attachment-disposition URL for the "הורד קובץ" button on the event page.
const getSignedDownloadUrl = unstable_cache(
  async (path: string, filename: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(COMMUNITY_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 30, { download: filename || true });
    return data?.signedUrl ?? null;
  },
  ["event-download-url-30d"],
  { revalidate: 60 * 60 }
);

async function resolveEvent(e: CommunityEvent): Promise<EventView> {
  // Sign the image + document URLs together rather than one after another.
  const [imageUrl, docUrl, docDownloadUrl] = await Promise.all([
    e.image_path ? getSignedUrl(e.image_path) : Promise.resolve(null),
    e.doc_path ? getSignedUrl(e.doc_path) : Promise.resolve(null),
    e.doc_path ? getSignedDownloadUrl(e.doc_path, e.doc_name ?? "") : Promise.resolve(null),
  ]);
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    eventDate: e.event_date,
    imageUrl,
    docUrl,
    docKind: e.doc_path ? docKind(e.doc_path) : null,
    docDownloadUrl,
  };
}

// Visible, titled, non-expired events in display order. React-cached so the
// carousel and the nav menu share one query per request (both need this list).
const getVisibleEventRows = cache(async (): Promise<CommunityEvent[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("community_events")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order")
    .order("event_date")
    .order("created_at");
  const today = israelToday();
  return ((data ?? []) as CommunityEvent[]).filter(
    (e) => e.title.trim() !== "" && notExpired(e.expires_at, today)
  );
});

/** Active events for the home-page carousel: visible, titled, not expired. */
export async function getActiveEvents(): Promise<EventView[]> {
  const rows = await getVisibleEventRows();
  return Promise.all(rows.map(resolveEvent));
}

/** Active events reduced to what the nav menu needs (id + title). */
export async function getEventsForMenu(): Promise<{ id: string; title: string }[]> {
  const rows = await getVisibleEventRows();
  return rows.map((e) => ({ id: e.id, title: e.title }));
}

/** A single event for its detail page, or null if missing/hidden/expired. */
export async function getEventForView(id: string): Promise<EventView | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("community_events").select("*").eq("id", id).maybeSingle();
  const e = data as CommunityEvent | null;
  if (!e || !e.is_visible || e.title.trim() === "" || !notExpired(e.expires_at)) return null;
  return resolveEvent(e);
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

/** Admin list with each event's image + document resolved to signed URLs. */
export async function getAllEventsForAdmin(): Promise<
  (CommunityEvent & { imageUrl: string | null; docUrl: string | null })[]
> {
  const events = await getAllEvents();
  return Promise.all(
    events.map(async (e) => ({
      ...e,
      imageUrl: e.image_path ? await getSignedUrl(e.image_path) : null,
      docUrl: e.doc_path ? await getSignedUrl(e.doc_path) : null,
    }))
  );
}
