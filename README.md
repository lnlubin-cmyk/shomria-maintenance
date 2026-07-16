# קיבוץ שומריה — מערכת ניהול תחזוקה

Maintenance management system for Kibbutz Shomria. Hebrew, RTL, built as a web app with a shared API so a future Android/iOS app can reuse the same backend.

Built from `מערכת ניהול תחזוקה.pdf`. Scope: maintenance management. The family-names map (goal #2) is not built — the schema reserves `buildings.latitude/longitude` for it.

## Stack

- **Next.js 14** (App Router, TypeScript, Server Actions)
- **Supabase** — Postgres, Auth (phone OTP + Google SSO), Row Level Security
- **Tailwind CSS** — RTL via `dir="rtl"`

## Status

Builds clean and runs against a live Supabase project. Verified end-to-end:

- **18/18 role and access tests** — each role sees exactly what it should over real HTTP, and a resident cannot see another resident's calls.
- **9/9 database guard tests** — a resident with a valid JWT, bypassing the UI entirely, cannot edit תיאור הטיפול, change status, delete calls, self-assign אחריות, read others' calls, dump the residents table, or promote themselves to admin.

Not yet exercised: the Excel import, the real phone-OTP flow (needs Twilio), and Google SSO (needs a Google OAuth client).

## ⚠️ Remove before deploying

`/dev-login` and `/api/dev-login` are an **authentication bypass**, added so the app is usable without a paid SMS provider. They are gated on `NODE_ENV !== "production"` **and** `ENABLE_DEV_LOGIN=true`, so a production build cannot expose them — but delete all three anyway:

```
src/app/dev-login/                 # the page
src/app/api/dev-login/route.ts     # the route
ENABLE_DEV_LOGIN=true              # the line in .env.local
```

`scripts/create-dev-users.mjs` creates sample-data accounts and should also go.

## Setup

### 1. Install dependencies

Node v18.17+ ([nodejs.org](https://nodejs.org/)).

```bash
cd shomria-maintenance
npm install
```

### 2. Create a Supabase project

At [supabase.com](https://supabase.com), create a project. Then in **SQL Editor**, run in order:

1. `supabase/migrations/0001_schema.sql` — tables, enums, triggers
2. `supabase/migrations/0002_rls.sql` — row level security
3. `supabase/migrations/0003_seed.sql` — sample residents and buildings

### 3. Environment variables

`.env.local` already exists but holds **placeholder values** — it was created to run the build. Replace them with real ones or nothing will connect.

Fill from **Settings → API**:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **server only, never commit** |

### 4. Enable auth providers

**Phone (SMS):** Authentication → Providers → Phone. Needs an SMS provider (Twilio/MessageBird) with credentials — SMS costs money per message. For development, Supabase can be set to log the OTP to the dashboard instead of sending it.

**Google:** Authentication → Providers → Google. Needs a Google Cloud OAuth client. Set the redirect URL to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000

### 6. Create the first admin

Every self-registered account gets the `resident` role, and only an admin can change roles — so the first admin is promoted by hand:

1. Sign in with the phone of the resident who should be admin. With the sample data, `050-100-0020` (דורית אלון) is the intended one.
2. Edit the phone in `scripts/bootstrap-admin.sql` and run it in the SQL editor.
3. Reload — the ניהול מערכת menu item appears.

From there, all further users are managed in the admin screen.

Optionally run `scripts/seed-faults.sql` for sample calls (requires at least one account to exist first).

## Roles

| Role | Can |
|---|---|
| תושב (`resident`) | Open calls; see only calls in their own name |
| איש תחזוקה (`maintenance`) | See all calls; edit status / treatment description / treatment type |
| מנהל תחזוקה (`maintenance_manager`) | As above, plus delete calls |
| אדמין (`admin`) | Everything, plus the admin screen |

## Screens

| Route | Who | What |
|---|---|---|
| `/` | Everyone | Home, sign-in, menu |
| `/login` | Guests | Phone OTP + Google SSO |
| `/faults/new` | Signed in | Open a new call |
| `/faults` | Signed in | Residents: own calls. Staff: full table with filters, multi-select, edit, delete |
| `/admin` | Admin | Users, residents, buildings, Excel import |

## Security model

The rules from the spec are enforced in the database, not just the UI — the UI hides buttons, the database refuses the writes.

- **RLS** gates every table. A resident's `select` on `faults` returns only their own rows; there is no client query that widens it.
- **`guard_fault_columns`** trigger enforces "a resident may not edit תיאור התיקון" at the column level, which RLS alone cannot express.
- **`force_initial_fault_status`** trigger makes every new call enter as `received` regardless of what the client sends.
- **Service-role routes** (`/api/auth/*`, `/api/admin/*`, admin actions) bypass RLS by design, so each one re-checks the caller's role server-side first.

Resident name search (`/api/residents/search`) returns names only, never phone numbers, so the "open a call for another resident" feature cannot be used to harvest contact details.

## Excel import format

Columns must be in this order (per the spec). A header row is detected and skipped.

| A | B | C | D |
|---|---|---|---|
| תעודת זהות | שם פרטי | שם משפחה | מספר טלפון |

Phone numbers are normalized to E.164 (`050-123-4567` → `+972501234567`). The file is validated whole: if any row is invalid, nothing is imported and every error is listed by row number.

Existing residents (matched by ID) are updated.

## Decisions worth reviewing

These went beyond what the document specified. Each is a place where the spec was silent or self-contradictory:

1. **`תיאור התקלה` added to the faults table.** The DB section of the spec lists the fault fields without it, but the screen section marks it mandatory. Added, since a fault with no description is unusable.
2. **`שם המבנה` is a foreign key**, not free text. Renaming a building would otherwise orphan its call history.
3. **Caller and author are separate columns.** `caller_resident_id` is שם הפונה; `created_by_user_id` is נפתחה ע"י. The spec implies these are the same field, but since a resident may open a call for someone else, they diverge.
4. **A resident may open a call for another resident and still see it** afterward, even though the spec says residents see only calls "on their name". Otherwise they'd file a call and lose track of it.
5. **`תאריך פתיחה` (`created_at`) added.** The spec's fault table has a close date but no open date, while the screen displays one.
6. **Bulk edit does not overwrite treatment descriptions unless opted in.** The spec describes editing multiple selected faults, but blindly applying one description across a selection would silently destroy the others' notes.
7. **`אחריות` is assigned from the fault edit dialog.** The spec defines the field but never says who assigns a maintenance worker or from which screen. This is the only screen staff work from, so it went there. Only `איש תחזוקה` / `מנהל תחזוקה` can be assigned.

## Sample data

20 fictional residents, 16 buildings. The ID numbers deliberately fail the Israeli check-digit test so they can never collide with a real תעודת זהות. Phones are `050-100-00XX`.

To clear before going live:

```sql
delete from faults;
delete from buildings;
delete from residents where id like '9000000%';
```

## Not built

- **Buildings map with family-name search** (spec goal #2). Schema is ready (`latitude`/`longitude` on `buildings`); needs coordinates per building, which the spec doesn't provide.
- **Mobile app.** The Supabase backend and RLS policies are reusable as-is from React Native.
- **Notifications** on status change. Not in the spec; likely wanted.
- **Automated tests.** None. The build passes, but no flow has been exercised against a real database — worth adding before the kibbutz depends on it.
