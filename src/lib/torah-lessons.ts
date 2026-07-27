import { createAdminClient } from "@/lib/supabase/server";
import type { TorahLesson } from "@/lib/types";

const SELECT = "id, subject, occurrence, hour, is_visible, sort_order";

/** All lessons (visible + hidden), for the admin tab. */
export async function getAllLessons(): Promise<TorahLesson[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("torah_lessons")
    .select(SELECT)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as TorahLesson[];
}

/** Visible lessons, in order, for the public page. */
export async function getVisibleLessons(): Promise<TorahLesson[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("torah_lessons")
    .select(SELECT)
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as TorahLesson[];
}
