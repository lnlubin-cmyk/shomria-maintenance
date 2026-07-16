/**
 * Creates one account per role for local development, so each view can be
 * inspected without an SMS provider.
 *
 *   node scripts/create-dev-users.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Idempotent: skips a resident who already has an account.
 *
 * These are sample-data residents. Delete before going live — see README.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { resident_id: "900000020", role: "admin", email: "dorit@example.com" },
  { resident_id: "900000019", role: "maintenance_manager", email: "rafi@example.com" },
  { resident_id: "900000017", role: "maintenance", email: "moshe@example.com" },
  { resident_id: "900000001", role: "resident", email: "yossi@example.com" },
];

for (const acct of ACCOUNTS) {
  const { data: resident } = await admin
    .from("residents")
    .select("id, first_name, last_name, phone")
    .eq("id", acct.resident_id)
    .maybeSingle();

  if (!resident) {
    console.log(`SKIP ${acct.resident_id} — resident not found (seed data missing?)`);
    continue;
  }

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("resident_id", acct.resident_id)
    .maybeSingle();

  if (existing) {
    console.log(`SKIP ${resident.first_name} ${resident.last_name} — account exists`);
    continue;
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: acct.email,
    phone: resident.phone,
    email_confirm: true,
    phone_confirm: true,
  });

  if (authError) {
    console.error(`FAIL ${acct.email} — ${authError.message}`);
    continue;
  }

  const { error } = await admin.from("users").insert({
    id: created.user.id,
    resident_id: resident.id,
    role: acct.role,
    email: acct.email,
    phone: resident.phone,
  });

  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error(`FAIL ${acct.email} — ${error.message}`);
    continue;
  }

  console.log(`OK   ${resident.first_name} ${resident.last_name} — ${acct.role}`);
}

console.log("\ndone");
