import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * DEVELOPMENT ONLY — an authentication bypass.
 *
 * Phone OTP needs a paid SMS provider, which makes it impossible to click
 * through the app locally. This mints a magic-link token for a chosen role so
 * the real screens can be inspected without one.
 *
 * Gated on TWO independent conditions, both of which must hold:
 *   1. NODE_ENV !== "production" — dead in any production build, full stop.
 *   2. ENABLE_DEV_LOGIN === "true" — explicit opt-in even in development.
 *
 * The NODE_ENV check is the real guarantee: shipping this to production cannot
 * open a hole even if the env var is set by mistake. Delete this route and its
 * page before deploying — see README.
 */
function devLoginAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

const ALLOWED_ROLES = ["admin", "maintenance_manager", "maintenance", "resident"];

export async function POST(request: Request) {
  if (!devLoginAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { role } = await request.json().catch(() => ({ role: null }));

  if (typeof role !== "string" || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("users")
    .select("email, resident:residents(first_name, last_name)")
    .eq("role", role)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();

  if (!user?.email) {
    return NextResponse.json(
      { error: `No account with role "${role}". Run scripts/create-dev-users.mjs first.` },
      { status: 404 }
    );
  }

  // generateLink returns the token instead of sending it — no email provider
  // is involved, and nothing is delivered anywhere.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });

  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: "Could not generate a session token" }, { status: 500 });
  }

  return NextResponse.json({
    token_hash: data.properties.hashed_token,
    email: user.email,
  });
}
