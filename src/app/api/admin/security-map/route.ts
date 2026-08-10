import { NextResponse } from "next/server";
import { getSession, createAdminClient } from "@/lib/supabase/server";
import { generateSecurityMapPdf, type MapBuilding } from "@/lib/security-map/generate";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Admin-only: generate the A3 security map PDF (aerial + every house name) and
 * return it as a download. Includes ALL placed houses (this is an internal
 * security document, so it is not filtered by the residents' share consent).
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("buildings")
    .select("building_name, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  const buildings: MapBuilding[] = (data ?? [])
    .filter((b) => b.building_name && b.latitude != null && b.longitude != null)
    .map((b) => ({ name: String(b.building_name).trim(), lat: Number(b.latitude), lon: Number(b.longitude) }));

  if (buildings.length === 0) {
    return NextResponse.json({ error: "אין בתים עם מיקום על המפה" }, { status: 400 });
  }

  try {
    const pdf = await generateSecurityMapPdf(buildings);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="shomria-security-map-A3.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("security-map generation failed:", e);
    return NextResponse.json({ error: "יצירת המפה נכשלה" }, { status: 500 });
  }
}
