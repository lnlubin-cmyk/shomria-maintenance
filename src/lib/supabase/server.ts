import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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
 * not yet linked to a resident.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, resident_id, role, email, phone, is_active, resident:residents(id, first_name, last_name, phone)")
    .eq("id", authUser.id)
    .single();

  if (error || !data || !data.resident) return null;
  if (!data.is_active) return null;

  const { resident, ...user } = data as any;
  return { user, resident };
}
