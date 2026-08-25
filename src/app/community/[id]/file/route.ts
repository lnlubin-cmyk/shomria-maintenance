import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { getCommunityItemForView } from "@/lib/community";

/**
 * Stable "open the file" endpoint for a קהילה document. On each request it mints
 * a FRESH signed URL and redirects to it, so the open/download button always
 * lands on a valid URL — even if the page it was clicked from had been sitting
 * open for hours (a captured signed URL would have expired by then).
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL(`/login?next=/community/${params.id}`, request.url));
  }

  const data = await getCommunityItemForView(params.id);
  if (!data || !data.url) {
    // Missing / hidden / no file (or a text item) — send back to the item page.
    return NextResponse.redirect(new URL(`/community/${params.id}`, request.url));
  }

  return NextResponse.redirect(data.url);
}
