import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/email";

/**
 * Google SSO lands here. Google provides a VERIFIED email, which is the
 * identity the system keys on — so linking is automatic when that email matches
 * a resident. No free-text entry step: accepting an unverified email would let
 * any Google user claim an unclaimed resident by typing their address. If the
 * Google email isn't a registered resident, we send them back to sign in with
 * the email-code flow, which proves ownership of the registered address.
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

  // Already linked — straight through.
  const { data: linked } = await admin
    .from("users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (linked) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const email = normalizeEmail(data.user.email ?? "");
  const resident = email
    ? (await admin.from("residents").select("id").eq("email", email).maybeSingle()).data
    : null;

  if (!resident) {
    // Not a resident's address. Sign out the half-formed session so a stale
    // Google login can't linger, and steer them to the verified email flow.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=sso_not_registered`);
  }

  // One account per resident.
  const { data: taken } = await admin
    .from("users")
    .select("id")
    .eq("resident_id", resident.id)
    .maybeSingle();

  if (taken) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=account_exists`);
  }

  const { error: insertError } = await admin.from("users").insert({
    id: data.user.id,
    resident_id: resident.id,
    role: "resident",
    email,
    phone: data.user.phone ?? null,
  });

  if (insertError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=link_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
