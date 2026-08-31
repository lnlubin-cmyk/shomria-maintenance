import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Session } from "@/lib/types";

// `cookies` accepts a union of the current and deprecated method shapes, so TS
// cannot contextually infer these callback params. Annotate from the source type.
type CookiesToSet = Parameters<SetAllCookies>[0];

/** Request-scoped client. Runs as the signed-in user, so RLS applies. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — the middleware refreshes the
            // session instead, so this is safe to swallow.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. BYPASSES row-level security — never expose to the
 * browser and never call from a Client Component. Used only by admin routes
 * that must write across users (creating accounts, bulk resident import).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * The signed-in user with their resident record, or null if not signed in or
 * not yet linked to a resident. Wrapped in React `cache` so multiple calls
 * within one request (e.g. a page and its header) share a single lookup instead
 * of each making the same round trips to Supabase.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = createClient();

  // Verify the access token's signature locally instead of getUser(), which
  // always makes a network round trip to the auth server. With asymmetric JWT
  // signing keys enabled, getClaims() checks the signature against the cached
  // public keys — no round trip. The middleware already ran the authoritative
  // refresh/gate for this request, and the is_active check below still rejects
  // a deactivated account.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims?.sub;

  if (claimsError || !authUserId) return null;

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, resident_id, role, first_name, last_name, email, phone, is_active, resident:residents(id, first_name, last_name, phone, email, share_phone, share_house, is_member)"
    )
    .eq("id", authUserId)
    .single();

  // A resident-linked user must have its resident row; an external staff user
  // legitimately has none. Reject only a truly orphaned row.
  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.resident_id && !data.resident) return null;

  const { resident, ...user } = data as any;
  const displayName = resident
    ? `${resident.first_name} ${resident.last_name}`
    : user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : "משתמש";

  return {
    user,
    resident: resident ?? null,
    displayName,
    residentId: resident?.id ?? null,
  };
});
