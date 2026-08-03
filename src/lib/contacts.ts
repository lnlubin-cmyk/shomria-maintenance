import { createAdminClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

const SELECT = "id, name, email, phone, is_visible, sort_order";

/** All contacts (visible + hidden), for the admin tab. */
export async function getAllContacts(): Promise<Contact[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contacts")
    .select(SELECT)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as Contact[];
}

/** Visible contacts, in order, for the public page. */
export async function getVisibleContacts(): Promise<Contact[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contacts")
    .select(SELECT)
    .eq("is_visible", true)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as Contact[];
}
