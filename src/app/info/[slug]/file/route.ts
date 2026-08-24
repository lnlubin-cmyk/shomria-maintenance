import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { getPanelView, isPanelSlug } from "@/lib/info-panels";

/**
 * Stable "open the file" endpoint for an info panel (מרפאה / מכולת …). Mints a
 * FRESH signed URL per request and redirects to it, so the open/download button
 * never lands on an expired URL (see the קהילה file route for the rationale).
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  if (!isPanelSlug(params.slug)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL(`/login?next=/info/${params.slug}`, request.url));
  }

  const panel = await getPanelView(params.slug);
  if (!panel || panel.mode !== "pdf" || !panel.url) {
    return NextResponse.redirect(new URL(`/info/${params.slug}`, request.url));
  }

  return NextResponse.redirect(panel.url);
}
