import { notFound, redirect } from "next/navigation";
import { getItemIdByKey } from "@/lib/community";

/**
 * Legacy route. מכולת/מרפאה used to live at /info/store · /info/clinic; they are
 * now ordinary menu items. Redirect any old (e.g. externally-shared) link to the
 * merged community item, which handles its own login gate.
 */
export default async function InfoRedirect({ params }: { params: { slug: string } }) {
  const id = await getItemIdByKey(params.slug);
  if (!id) notFound();
  redirect(`/community/${id}`);
}
