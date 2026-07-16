import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Google SSO lands here. The account exists in auth.users, but SSO gives us an
 * email — not the phone number the spec identifies residents by. If the account
 * is not yet linked to a resident, send them to /auth/link to supply it.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/faults";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const admin = createAdminClient();
  const { data: linked } = await admin
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!linked) {
    return NextResponse.redirect(`${origin}/auth/link?next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
